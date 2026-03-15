/**
 * McKibbon Income Statement PDF Parser
 * Extracts financial data from the standard McKibbon PDF format.
 *
 * PDF Layout (after pdf-parse text extraction):
 * - Numbers are concatenated without spaces
 * - Stats section: labels on own lines, PTD values on line above, YTD on line below
 * - Financial section: PTD values + Label + YTD values on single line, OR label on own line
 * - Each side has up to 9 columns: [Budget, Budget%, BudgetPOR, Actual, Actual%, ActualPOR, PY, PY%, PYPOR]
 * - Stats lines have 6 columns: [Budget, BudgetPOR, Actual, ActualPOR, PY, PYPOR]
 */

import { MonthlyPeriod } from "./types";

// ─── Number Parsing ───────────────────────────────────────────────────────────

/** Parse a number from McKibbon format: handles ($1,234), 1,234, 75.20%, $142.38 */
function parseNumber(raw: string | undefined): number | null {
  if (!raw || raw.trim() === "" || raw.trim() === "—" || raw.trim() === "-") return null;
  let s = raw.trim();
  const isNeg = s.startsWith("(") || s.startsWith("-");
  s = s.replace(/[$%,()]/g, "").trim();
  if (s === "" || isNaN(Number(s))) return null;
  const val = parseFloat(s);
  return isNeg ? -val : val;
}

/** Convert dollars to cents */
function toCents(val: number | null): number | null {
  if (val == null) return null;
  return Math.round(val * 100);
}

/** Convert percentage to decimal (75.2 -> 0.752) */
function pctToDecimal(val: number | null): number | null {
  if (val == null) return null;
  if (Math.abs(val) <= 1 && Math.abs(val) > 0) return val;
  return val / 100;
}

// ─── Tokenizer ────────────────────────────────────────────────────────────────

/**
 * Tokenize a concatenated number string from McKibbon PDF.
 * Handles patterns like: 742,566100.00%235.29771,202100.00%244.98
 *
 * Token types (matched in priority order):
 * 1. Negative numbers in parens: (1,234) or (1,234.56)
 * 2. Comma numbers with decimals and %: 1,234.56%
 * 3. Percentage with decimals: 100.00% or 0.03%
 * 4. Comma numbers with decimals: 1,234.56
 * 5. Comma numbers (integers): 742,566
 * 6. Decimal numbers: 235.29 (limited to 2 decimal places to avoid over-matching)
 * 7. Plain integers: 0, 1, 42
 */
function tokenizeNumbers(text: string): string[] {
  // The key insight: all decimals in McKibbon PDFs have exactly 2 decimal places.
  // This lets us split 235.29771,202 correctly as [235.29, 771,202].
  const tokenRegex =
    /\([\d,]+(?:\.\d{2})?\)|\d{1,3}(?:,\d{3})+\.\d{2}%|\d+\.\d{2}%|\d{1,3}(?:,\d{3})+\.\d{2}|\d{1,3}(?:,\d{3})+|\d+\.\d{2}|\d+/g;

  const rawTokens: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(text)) !== null) {
    rawTokens.push(match[0]);
  }

  // Post-process: split merged tokens where a dollar amount concatenated with a percentage.
  // pdf-parse produces these when adjacent PDF text elements have no space between them.
  // Two detectable patterns:
  //   A) value > 100%  → impossible as a real percentage → e.g. "1170.02%", "240.00%"
  //   B) starts with "00" → invalid percentage prefix → e.g. "00.00%" (zero dollar + 0.00%)
  // In both cases: last digit of the integer part is the first digit of the absorbed percentage.
  const tokens: string[] = [];
  for (const t of rawTokens) {
    if (t.endsWith("%")) {
      const dotIdx = t.indexOf(".");
      const intStr = t.slice(0, dotIdx); // digits before decimal
      const decStr = t.slice(dotIdx + 1, -1); // 2 digits after decimal, before %
      const pctValue = parseFloat(t.replace(/%$/, ""));

      // Case A: value > 100% — can't be valid, must be merged dollar + percentage
      if (pctValue > 100) {
        const dollarStr = intStr.slice(0, -1); // strip last digit (first digit of the pct)
        const pctFirstDigit = intStr.slice(-1);
        tokens.push(dollarStr);
        tokens.push(`${pctFirstDigit}.${decStr}%`);
        continue;
      }

      // Case B: starts with "00" — zero dollar merged with 0.xx%
      if (intStr.startsWith("00")) {
        tokens.push("0");
        tokens.push(`0.${decStr}%`);
        continue;
      }
    }
    tokens.push(t);
  }

  return tokens;
}

// ─── Line Classification & Label Finding ──────────────────────────────────────

/** Check if a line is purely numeric (no alphabetic chars) */
function isNumericLine(line: string): boolean {
  // Allow digits, commas, periods, percent signs, parens, dashes, spaces
  return /^[\d,.\-%() ]+$/.test(line.trim());
}

/**
 * Find the label text embedded in a line of numbers.
 * Returns { label, ptdText, ytdText } or null if no label found.
 */
function splitAtLabel(line: string): { label: string; ptdText: string; ytdText: string } | null {
  // Labels contain letters. Find the first run of alphabetic text (may include &, ., -, spaces)
  // Pattern: look for a sequence starting with a letter, possibly containing letters, spaces, &, ., -
  const labelMatch = line.match(/([A-Za-z][A-Za-z &.\-'\/,]*[A-Za-z.])/);
  if (!labelMatch) return null;

  const label = labelMatch[1].trim();
  const labelStart = line.indexOf(labelMatch[1]);
  const labelEnd = labelStart + labelMatch[1].length;

  return {
    label,
    ptdText: line.substring(0, labelStart),
    ytdText: line.substring(labelEnd),
  };
}

// ─── Structured Row Parsing ───────────────────────────────────────────────────

interface ParsedValues {
  budget: number | null;
  budgetPct: number | null;
  actual: number | null;
  actualPct: number | null;
  py: number | null;
  pyPct: number | null;
}

/**
 * Extract Budget, Actual, PY from a tokenized number string.
 * For 9-token lines (revenue/expense): indices 0, 3, 6 are the dollar values; 1, 4, 7 are percentages
 * For 6-token lines (stats): indices 0, 2, 4 are the values
 * For 3-token lines: indices 0, 1, 2
 */
function extractValues(tokens: string[]): ParsedValues {
  const nums = tokens.map(t => parseNumber(t));

  if (tokens.length >= 9) {
    // 9-column: [Budget, Budget%, BudgetPOR, Actual, Actual%, ActualPOR, PY, PY%, PYPOR]
    return {
      budget: nums[0] ?? null,
      budgetPct: nums[1] ?? null,
      actual: nums[3] ?? null,
      actualPct: nums[4] ?? null,
      py: nums[6] ?? null,
      pyPct: nums[7] ?? null,
    };
  } else if (tokens.length >= 6) {
    // 6-column stats: [Budget, BudgetPOR, Actual, ActualPOR, PY, PYPOR]
    return {
      budget: nums[0] ?? null,
      budgetPct: null,
      actual: nums[2] ?? null,
      actualPct: null,
      py: nums[4] ?? null,
      pyPct: null,
    };
  } else if (tokens.length >= 3) {
    return {
      budget: nums[0] ?? null,
      budgetPct: null,
      actual: nums[1] ?? null,
      actualPct: null,
      py: nums[2] ?? null,
      pyPct: null,
    };
  }
  return { budget: nums[0] ?? null, budgetPct: null, actual: nums[0] ?? null, actualPct: null, py: null, pyPct: null };
}

// ─── Stats Section Parser ─────────────────────────────────────────────────────

/**
 * For stats rows where the label is on its own line, the PTD values are on the
 * preceding line and YTD values are on the following line.
 * Special case: "Rooms Available" and "Rooms Occupied" have integer POR values (always 1)
 * that get concatenated with the room counts (e.g., "3,52813,52813,5281").
 * We handle this by matching (comma_number)(single_digit) patterns.
 */
function parseRoomCountLine(text: string): number[] {
  // Match comma-numbers followed by their POR digit (always 1 for rooms)
  const matches: number[] = [];
  const regex = /(\d{1,3}(?:,\d{3})+)(\d)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    matches.push(parseNumber(m[1])!);
  }
  if (matches.length >= 3) return matches;

  // Fallback: try standard tokenization
  const tokens = tokenizeNumbers(text);
  return tokens.map(t => parseNumber(t)).filter((n): n is number => n !== null);
}

interface StatsResult {
  occupancy: ParsedValues;
  adr: ParsedValues;
  revpar: ParsedValues;
  roomsSold: ParsedValues;
  roomsAvailable: ParsedValues;
  occupancyYtd: ParsedValues;
  adrYtd: ParsedValues;
  revparYtd: ParsedValues;
  roomsSoldYtd: ParsedValues;
  roomsAvailableYtd: ParsedValues;
}

function parseStatsSection(lines: string[]): Partial<StatsResult> {
  const result: Partial<StatsResult> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === "Occupancy") {
      const ptdLine = i > 0 ? lines[i - 1].trim() : "";
      const ytdLine = i < lines.length - 1 ? lines[i + 1].trim() : "";
      const ptdTokens = tokenizeNumbers(ptdLine);
      const ytdTokens = tokenizeNumbers(ytdLine);
      // Occupancy tokens are percentages: [Budget%, BudgetPOR%, Actual%, ActualPOR%, PY%, PYPOR%]
      if (ptdTokens.length >= 6) {
        result.occupancy = {
          budget: parseNumber(ptdTokens[0]),
          budgetPct: null,
          actual: parseNumber(ptdTokens[2]),
          actualPct: null,
          py: parseNumber(ptdTokens[4]),
          pyPct: null,
        };
      }
      if (ytdTokens.length >= 6) {
        result.occupancyYtd = {
          budget: parseNumber(ytdTokens[0]),
          budgetPct: null,
          actual: parseNumber(ytdTokens[2]),
          actualPct: null,
          py: parseNumber(ytdTokens[4]),
          pyPct: null,
        };
      }
    }

    if (line === "Average Daily Rate") {
      const ptdLine = i > 0 ? lines[i - 1].trim() : "";
      const ytdLine = i < lines.length - 1 ? lines[i + 1].trim() : "";
      const ptdTokens = tokenizeNumbers(ptdLine);
      const ytdTokens = tokenizeNumbers(ytdLine);
      if (ptdTokens.length >= 6) {
        result.adr = {
          budget: parseNumber(ptdTokens[0]),
          budgetPct: null,
          actual: parseNumber(ptdTokens[2]),
          actualPct: null,
          py: parseNumber(ptdTokens[4]),
          pyPct: null,
        };
      }
      if (ytdTokens.length >= 6) {
        result.adrYtd = {
          budget: parseNumber(ytdTokens[0]),
          budgetPct: null,
          actual: parseNumber(ytdTokens[2]),
          actualPct: null,
          py: parseNumber(ytdTokens[4]),
          pyPct: null,
        };
      }
    }

    if (line === "Revenue per Avl Room") {
      const ptdLine = i > 0 ? lines[i - 1].trim() : "";
      const ytdLine = i < lines.length - 1 ? lines[i + 1].trim() : "";
      const ptdTokens = tokenizeNumbers(ptdLine);
      const ytdTokens = tokenizeNumbers(ytdLine);
      if (ptdTokens.length >= 6) {
        result.revpar = {
          budget: parseNumber(ptdTokens[0]),
          budgetPct: null,
          actual: parseNumber(ptdTokens[2]),
          actualPct: null,
          py: parseNumber(ptdTokens[4]),
          pyPct: null,
        };
      }
      if (ytdTokens.length >= 6) {
        result.revparYtd = {
          budget: parseNumber(ytdTokens[0]),
          budgetPct: null,
          actual: parseNumber(ytdTokens[2]),
          actualPct: null,
          py: parseNumber(ytdTokens[4]),
          pyPct: null,
        };
      }
    }

    if (line === "Rooms Occupied") {
      const ptdLine = i > 0 ? lines[i - 1].trim() : "";
      const ytdLine = i < lines.length - 1 ? lines[i + 1].trim() : "";
      const ptdVals = parseRoomCountLine(ptdLine);
      const ytdVals = parseRoomCountLine(ytdLine);
      result.roomsSold = {
        budget: ptdVals[0] ?? null,
        budgetPct: null,
        actual: ptdVals[1] ?? null,
        actualPct: null,
        py: ptdVals[2] ?? null,
        pyPct: null,
      };
      result.roomsSoldYtd = {
        budget: ytdVals[0] ?? null,
        budgetPct: null,
        actual: ytdVals[1] ?? null,
        actualPct: null,
        py: ytdVals[2] ?? null,
        pyPct: null,
      };
    }

    // Rooms Available might be on its own line or embedded
    if (line.includes("Rooms Available")) {
      const split = splitAtLabel(line);
      if (split && split.label === "Rooms Available") {
        const ptdVals = parseRoomCountLine(split.ptdText);
        const ytdVals = parseRoomCountLine(split.ytdText);
        result.roomsAvailable = {
          budget: ptdVals[0] ?? null,
          budgetPct: null,
          actual: ptdVals[1] ?? null,
          actualPct: null,
          py: ptdVals[2] ?? null,
          pyPct: null,
        };
        result.roomsAvailableYtd = {
          budget: ytdVals[0] ?? null,
          budgetPct: null,
          actual: ytdVals[1] ?? null,
          actualPct: null,
          py: ytdVals[2] ?? null,
          pyPct: null,
        };
      } else if (line.trim() === "Rooms Available") {
        // Label on own line
        const ptdLine2 = i > 0 ? lines[i - 1].trim() : "";
        const ytdLine2 = i < lines.length - 1 ? lines[i + 1].trim() : "";
        const ptdVals = parseRoomCountLine(ptdLine2);
        const ytdVals = parseRoomCountLine(ytdLine2);
        result.roomsAvailable = {
          budget: ptdVals[0] ?? null,
          budgetPct: null,
          actual: ptdVals[1] ?? null,
          actualPct: null,
          py: ptdVals[2] ?? null,
          pyPct: null,
        };
        result.roomsAvailableYtd = {
          budget: ytdVals[0] ?? null,
          budgetPct: null,
          actual: ytdVals[1] ?? null,
          actualPct: null,
          py: ytdVals[2] ?? null,
          pyPct: null,
        };
      }
    }
  }

  return result;
}

// ─── Financial Row Parser ─────────────────────────────────────────────────────

interface FinancialRow {
  ptd: ParsedValues;
  ytd: ParsedValues;
}

/**
 * Find and parse a financial row by exact label.
 *
 * The label may be:
 * 1. Embedded in the middle of a single line (PTD numbers + label + YTD numbers)
 * 2. On its own line with PTD values on the line above and YTD on the line below
 *
 * For exact matching: the label must be the complete alphabetic segment
 * (not a substring of a longer label).
 */
function findFinancialRow(lines: string[], label: string): FinancialRow | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Case 1: Label on its own line (possibly with whitespace)
    if (line === label) {
      const ptdLine = i > 0 ? lines[i - 1].trim() : "";
      const ytdLine = i < lines.length - 1 ? lines[i + 1].trim() : "";

      if (isNumericLine(ptdLine) && ptdLine.length > 0) {
        const ptdTokens = tokenizeNumbers(ptdLine);
        const ytdTokens = tokenizeNumbers(ytdLine);
        return {
          ptd: extractValues(ptdTokens),
          ytd: extractValues(ytdTokens),
        };
      }
    }

    // Case 2: Label embedded in a line with numbers
    if (line.includes(label)) {
      const split = splitAtLabel(line);
      if (!split) continue;

      // Exact match: the extracted label must equal our target or contain it as
      // a standalone segment. For labels like "Total Sales", we need to make sure
      // we don't match "Total Sales Dept. Exp." or "Total Sales Empl. Exp."
      const extractedLabel = split.label;

      // Check if the extracted label IS the target, or the target appears as a
      // word-boundary-delimited segment
      if (extractedLabel !== label) {
        // Allow match if the label appears at the start and is immediately
        // followed by end-of-string (i.e., it's the entire label)
        // Also handle labels with spaces like "G O P" — check exact match
        if (!isExactLabelMatch(extractedLabel, label)) {
          continue;
        }
      }

      const ptdTokens = tokenizeNumbers(split.ptdText);
      const ytdTokens = tokenizeNumbers(split.ytdText);
      return {
        ptd: extractValues(ptdTokens),
        ytd: extractValues(ytdTokens),
      };
    }
  }
  return null;
}

/**
 * Check if extractedLabel is an exact match for target label.
 * Handles cases like extractedLabel="Admin & General" matching target="Admin & General"
 * but extractedLabel="Total Sales Dept. Exp." NOT matching target="Total Sales"
 */
function isExactLabelMatch(extractedLabel: string, target: string): boolean {
  // Exact string match
  if (extractedLabel === target) return true;

  // The extracted label starts with the target and the next char is not a letter
  // (handles cases where split captures the label plus trailing text)
  if (extractedLabel.startsWith(target)) {
    const rest = extractedLabel.substring(target.length).trim();
    if (rest === "") return true;
    // If remainder starts with non-letter, it's likely trailing POR/numbers
    return false;
  }

  return false;
}

/**
 * Sum multiple financial rows (e.g., for insurance which is split across 4 lines).
 */
function sumFinancialRows(lines: string[], labels: string[]): FinancialRow | null {
  let hasSome = false;
  const totals: FinancialRow = {
    ptd: { budget: 0, budgetPct: null, actual: 0, actualPct: null, py: 0, pyPct: null },
    ytd: { budget: 0, budgetPct: null, actual: 0, actualPct: null, py: 0, pyPct: null },
  };

  for (const label of labels) {
    const row = findFinancialRow(lines, label);
    if (row) {
      hasSome = true;
      totals.ptd.budget = (totals.ptd.budget ?? 0) + (row.ptd.budget ?? 0);
      totals.ptd.actual = (totals.ptd.actual ?? 0) + (row.ptd.actual ?? 0);
      totals.ptd.py = (totals.ptd.py ?? 0) + (row.ptd.py ?? 0);
      totals.ytd.budget = (totals.ytd.budget ?? 0) + (row.ytd.budget ?? 0);
      totals.ytd.actual = (totals.ytd.actual ?? 0) + (row.ytd.actual ?? 0);
      totals.ytd.py = (totals.ytd.py ?? 0) + (row.ytd.py ?? 0);
    }
  }

  return hasSome ? totals : null;
}

// ─── Period Extraction ────────────────────────────────────────────────────────

/** Extract period from PDF text header */
export function extractPeriodFromText(text: string): { year: number; month: number; period: string } | null {
  // Look for "Period from M/D/YYYY to M/D/YYYY"
  const periodMatch = text.match(/Period from\s+(\d{1,2})\/\d{1,2}\/(\d{4})\s+to/i);
  if (periodMatch) {
    const month = parseInt(periodMatch[1]);
    const year = parseInt(periodMatch[2]);
    const period = `${year}-${String(month).padStart(2, "0")}-01`;
    return { year, month, period };
  }

  // Fallback: look for filename pattern MM-YYYY
  const fnMatch = text.match(/(\d{2})-(\d{4})/);
  if (fnMatch) {
    const month = parseInt(fnMatch[1]);
    const year = parseInt(fnMatch[2]);
    const period = `${year}-${String(month).padStart(2, "0")}-01`;
    return { year, month, period };
  }

  return null;
}

// ─── Main Parser ──────────────────────────────────────────────────────────────

/** Main parser: takes raw PDF text, returns MonthlyPeriod data */
/**
 * Old-format PDF parser (>3000 lines): pdf-parse fragments numbers character-by-character.
 * Joining all fragments produces the same compact layout as modern PDFs.
 * We extract a 250-char window around the label and tokenize it.
 */
function findFinancialRowOldFormat(collapsed: string, label: string): FinancialRow | null {
  const idx = collapsed.indexOf(label);
  if (idx < 0) return null;
  // Take last 9 tokens immediately before the label (closest = this row's values)
  const ptdText = collapsed.substring(Math.max(0, idx - 250), idx);
  const ytdText = collapsed.substring(idx + label.length, Math.min(collapsed.length, idx + label.length + 250));
  const allPtdTokens = tokenizeNumbers(ptdText);
  const allYtdTokens = tokenizeNumbers(ytdText);
  // Use only the LAST 9 pre-label tokens (immediately before the label = this row)
  const ptdTokens = allPtdTokens.slice(-9);
  // Use only the FIRST 9 post-label tokens (immediately after = YTD this row)
  const ytdTokens = allYtdTokens.slice(0, 9);
  return {
    ptd: extractValues(ptdTokens),
    ytd: extractValues(ytdTokens),
  };
}

export function parseMcKibbonPDF(text: string, filename?: string): Partial<MonthlyPeriod> {
  const rawLines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const isOldFormat = rawLines.length > 3000;
  const lines = isOldFormat
    ? [rawLines.join("")]   // collapse fragments into one searchable string
    : rawLines;
  const collapsed = isOldFormat ? lines[0] : null;

  // Helper: route to old-format search when needed
  const findRow = (label: string) =>
    isOldFormat && collapsed
      ? findFinancialRowOldFormat(collapsed, label)
      : findFinancialRow(lines, label);

  // Extract period
  const fullText = filename ? text + "\n" + filename : text;
  const periodInfo = extractPeriodFromText(fullText);

  const result: Partial<MonthlyPeriod> = {
    period: periodInfo?.period,
    year: periodInfo?.year,
    month: periodInfo?.month,
    source_file: filename ?? null,
  };

  // ── Stats Section ──────────────────────────────────────────────────────────
  const stats = parseStatsSection(lines);

  if (stats.occupancy) {
    result.occupancy_pct = pctToDecimal(stats.occupancy.actual);
    result.occupancy_pct_budget = pctToDecimal(stats.occupancy.budget);
    result.occupancy_pct_py = pctToDecimal(stats.occupancy.py);
  }

  if (stats.adr) {
    result.adr = toCents(stats.adr.actual);
    result.adr_budget = toCents(stats.adr.budget);
    result.adr_py = toCents(stats.adr.py);
  }

  if (stats.revpar) {
    result.revpar = toCents(stats.revpar.actual);
    result.revpar_budget = toCents(stats.revpar.budget);
    result.revpar_py = toCents(stats.revpar.py);
  }

  if (stats.roomsSold) {
    result.rooms_sold = stats.roomsSold.actual ? Math.round(stats.roomsSold.actual) : null;
  }

  if (stats.roomsAvailable) {
    result.rooms_available = stats.roomsAvailable.actual ? Math.round(stats.roomsAvailable.actual) : null;
  }

  // ── Revenue ────────────────────────────────────────────────────────────────

  const roomSales = findRow( "Room Sales");
  if (roomSales) {
    result.room_revenue = toCents(roomSales.ptd.actual);
    result.room_revenue_budget = toCents(roomSales.ptd.budget);
    result.room_revenue_py = toCents(roomSales.ptd.py);
    result.room_revenue_ytd = toCents(roomSales.ytd.actual);
  }

  // F&B = Restaurant + Lounge
  const restaurant = findRow( "Restaurant Sales");
  const lounge = findRow( "Lounge Sales");
  const fbRev = (restaurant?.ptd.actual ?? 0) + (lounge?.ptd.actual ?? 0);
  const fbRevBudget = (restaurant?.ptd.budget ?? 0) + (lounge?.ptd.budget ?? 0);
  const fbRevPY = (restaurant?.ptd.py ?? 0) + (lounge?.ptd.py ?? 0);
  result.fb_revenue = toCents(fbRev || null);
  result.fb_revenue_budget = toCents(fbRevBudget || null);
  result.fb_revenue_py = toCents(fbRevPY || null);

  // Other operated revenue
  const guestComm = findRow( "Guest Communications");
  result.other_operated_revenue = toCents(guestComm?.ptd.actual ?? null);

  // Other/Misc income
  const otherIncome = findRow( "Other Income");
  result.misc_income = toCents(otherIncome?.ptd.actual ?? null);

  // Total Revenue — use exact label matching to avoid "Total Sales Dept. Exp." etc.
  const totalSales = findRow( "Total Sales");
  if (totalSales) {
    result.total_revenue = toCents(totalSales.ptd.actual);
    result.total_revenue_budget = toCents(totalSales.ptd.budget);
    result.total_revenue_py = toCents(totalSales.ptd.py);
    result.total_revenue_ytd = toCents(totalSales.ytd.actual);
    result.total_revenue_ytd_budget = toCents(totalSales.ytd.budget);
  }

  // ── Departmental Expenses ──────────────────────────────────────────────────

  const roomExp = findRow( "Room Expense");
  if (roomExp) {
    result.rooms_expense = toCents(roomExp.ptd.actual);
    result.rooms_expense_budget = toCents(roomExp.ptd.budget);
  }

  const restExp = findRow( "Restaurant Expense");
  const loungeExp = findRow( "Lounge Expense");
  const fbExp = (restExp?.ptd.actual ?? 0) + (loungeExp?.ptd.actual ?? 0);
  const fbExpBudget = (restExp?.ptd.budget ?? 0) + (loungeExp?.ptd.budget ?? 0);
  result.fb_expense = toCents(fbExp || null);
  result.fb_expense_budget = toCents(fbExpBudget || null);

  const otherExp = findRow( "Other Expense");
  result.other_operated_expense = toCents(otherExp?.ptd.actual ?? null);

  // ── Undistributed Expenses ─────────────────────────────────────────────────

  const adminGen = findRow( "Admin & General");
  if (adminGen) {
    result.admin_general = toCents(adminGen.ptd.actual);
    result.admin_general_budget = toCents(adminGen.ptd.budget);
  }

  const advPromo = findRow( "Adv. & Promotion");
  if (advPromo) {
    result.sales_marketing = toCents(advPromo.ptd.actual);
    result.sales_marketing_budget = toCents(advPromo.ptd.budget);
  }

  const infoTel = findRow( "Info and Telecom");
  if (infoTel) result.it_telecom = toCents(infoTel.ptd.actual);

  const util = findRow( "Utilities");
  if (util) {
    result.utilities = toCents(util.ptd.actual);
    result.utilities_budget = toCents(util.ptd.budget);
  }

  const maint = findRow( "Maintenance & Repair");
  if (maint) {
    result.property_ops_maintenance = toCents(maint.ptd.actual);
    result.property_ops_maintenance_budget = toCents(maint.ptd.budget);
  }

  // ── GOP ────────────────────────────────────────────────────────────────────

  const gop = findRow( "G O P");
  if (gop) {
    result.gross_operating_profit = toCents(gop.ptd.actual);
    result.gop_budget = toCents(gop.ptd.budget);
    result.gop_py = toCents(gop.ptd.py);
    result.gop_ytd = toCents(gop.ytd.actual);
    result.gop_ytd_budget = toCents(gop.ytd.budget);
    result.gop_pct = gop.ptd.actualPct ? pctToDecimal(gop.ptd.actualPct) : null;
    result.gop_pct_budget = gop.ptd.budgetPct ? pctToDecimal(gop.ptd.budgetPct) : null;
  }

  // ── Fixed Charges ──────────────────────────────────────────────────────────

  const mgmtFee = findRow( "MANAGEMENT FEE");
  if (mgmtFee) result.management_fees = toCents(mgmtFee.ptd.actual);

  const propTax = findRow( "REAL ESTATE TAXES");
  if (propTax) result.property_taxes = toCents(propTax.ptd.actual);

  // Insurance: sum 4 separate lines
  const insurance = sumFinancialRows(lines, [
    "PROPERTY INSURANCE",
    "INSURANCE -GENERAL",
    "INSURANCE -EPLI",
    "INSURANCE -CYBER",
  ]);
  if (insurance) result.insurance = toCents(insurance.ptd.actual);

  const reserve = findRow( "RESERVE FUND");
  if (reserve) result.reserve_for_replacement = toCents(reserve.ptd.actual);

  // ── NOP ────────────────────────────────────────────────────────────────────

  // Try multiple label variants. The PDF uses "N O P Hotel" for the final NOP line
  const nop =
    findRow( "N O P Hotel") ||
    findRow( "Net Operating Profit") ||
    findRow( "NET OPERATING PROFIT") ||
    findRow( "N O P") ||
    findRow( "NOP");

  if (nop) {
    result.nop_hotel = toCents(nop.ptd.actual);
    result.nop_hotel_budget = toCents(nop.ptd.budget);
    result.nop_hotel_py = toCents(nop.ptd.py);
    result.nop_hotel_ytd = toCents(nop.ytd.actual);
    result.nop_hotel_ytd_budget = toCents(nop.ytd.budget);
    result.nop_pct = nop.ptd.actualPct ? pctToDecimal(nop.ptd.actualPct) : null;
    result.nop_pct_budget = nop.ptd.budgetPct ? pctToDecimal(nop.ptd.budgetPct) : null;
  }

  // Calculate NOP% if we have the values but not from direct extraction
  if (result.nop_hotel && result.total_revenue && !result.nop_pct) {
    result.nop_pct = result.nop_hotel / result.total_revenue;
  }
  if (result.gross_operating_profit && result.total_revenue && !result.gop_pct) {
    result.gop_pct = result.gross_operating_profit / result.total_revenue;
  }

  return result;
}
