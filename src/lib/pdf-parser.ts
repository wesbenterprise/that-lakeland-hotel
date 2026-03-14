/**
 * McKibbon Income Statement PDF Parser
 * Extracts financial data from the standard McKibbon PDF format.
 * 
 * The PDF layout has:
 * - Item labels in the middle column
 * - PTD Budget | PTD % | PTD POR | PTD Actual | PTD % | PTD POR | PTD LY | ... on left
 * - YTD columns on right
 */

import { MonthlyPeriod } from "./types";

interface ParsedRow {
  label: string;
  ptdBudget: number | null;
  ptdBudgetPct: number | null;
  ptdActual: number | null;
  ptdActualPct: number | null;
  ptdLY: number | null;
  ptdLYPct: number | null;
  ytdBudget: number | null;
  ytdActual: number | null;
  ytdLY: number | null;
}

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

/** Convert percentage string to decimal (75.2% -> 0.752) */
function pctToDecimal(val: number | null): number | null {
  if (val == null) return null;
  // If already < 1, it might already be decimal
  if (Math.abs(val) <= 1 && Math.abs(val) > 0) return val;
  return val / 100;
}

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

/** Main parser: takes raw PDF text, returns MonthlyPeriod data */
export function parseMcKibbonPDF(text: string, filename?: string): Partial<MonthlyPeriod> {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  
  // Extract period
  const fullText = filename ? text + "\n" + filename : text;
  const periodInfo = extractPeriodFromText(fullText);
  
  const result: Partial<MonthlyPeriod> = {
    period: periodInfo?.period,
    year: periodInfo?.year,
    month: periodInfo?.month,
    source_file: filename ?? null,
  };

  // Parse key metrics by searching for label patterns
  const findValue = (labelPattern: RegExp, lines: string[]): ParsedRow | null => {
    for (const line of lines) {
      if (labelPattern.test(line)) {
        // Extract numbers from the line
        const nums = line.match(/[-$()0-9,.]+%?/g) || [];
        if (nums.length >= 3) {
          return {
            label: line,
            ptdBudget: parseNumber(nums[0]),
            ptdBudgetPct: nums.length > 1 ? parseNumber(nums[1]) : null,
            ptdActual: parseNumber(nums[nums.length >= 9 ? 3 : (nums.length >= 6 ? 3 : 1)]),
            ptdActualPct: nums.length > 4 ? parseNumber(nums[4]) : null,
            ptdLY: parseNumber(nums[nums.length >= 9 ? 6 : (nums.length >= 6 ? 5 : 2)]),
            ptdLYPct: null,
            ytdBudget: nums.length > 9 ? parseNumber(nums[9]) : null,
            ytdActual: nums.length > 12 ? parseNumber(nums[12]) : null,
            ytdLY: nums.length > 15 ? parseNumber(nums[15]) : null,
          };
        }
      }
    }
    return null;
  };

  // Helper for structured table parsing
  // The PDF text typically has numbers separated by whitespace 
  // Format: BudgetVal BudgetPct BudgetPOR ActualVal ActualPct ActualPOR LYVal LYPct LYPOR Label YTDBud YTDBudPct YTDBudPOR YTDActual YTDActPct YTDActPOR YTDLY YTDLYPct YTDLYPOR

  const parseRow = (label: string): {
    ptdBudget: number | null;
    ptdActual: number | null;
    ptdLY: number | null;
    ptdActualPct: number | null;
    ptdBudgetPct: number | null;
    ytdBudget: number | null;
    ytdActual: number | null;
  } | null => {
    // Find line containing the label
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(label)) {
        const line = lines[i];
        // Split by multiple spaces or tabs to get columns
        const parts = line.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
        
        if (parts.length >= 3) {
          // Try to identify which parts are numbers vs labels
          const numParts: (number | null)[] = [];
          for (const p of parts) {
            const n = parseNumber(p);
            numParts.push(n);
          }
          
          // Find the label position and extract values around it
          const labelIdx = parts.findIndex(p => p.includes(label));
          
          if (labelIdx >= 0) {
            // Numbers before label are PTD (budget, %, POR, actual, %, POR, LY, %, POR)
            const before = numParts.slice(0, labelIdx).filter(n => n !== null) as number[];
            const after = numParts.slice(labelIdx + 1).filter(n => n !== null) as number[];
            
            return {
              ptdBudget: before[0] ?? null,
              ptdActual: before.length >= 4 ? before[3] : (before[1] ?? null),
              ptdLY: before.length >= 7 ? before[6] : (before[2] ?? null),
              ptdActualPct: before.length >= 5 ? before[4] : null,
              ptdBudgetPct: before.length >= 2 ? before[1] : null,
              ytdBudget: after[0] ?? null,
              ytdActual: after.length >= 4 ? after[3] : (after[1] ?? null),
            };
          }
        }
      }
    }
    return null;
  };

  // Operating Stats
  const occupancy = parseRow("Occupancy");
  if (occupancy) {
    result.occupancy_pct = pctToDecimal(occupancy.ptdActual);
    result.occupancy_pct_budget = pctToDecimal(occupancy.ptdBudget);
    result.occupancy_pct_py = pctToDecimal(occupancy.ptdLY);
  }

  const adr = parseRow("Average Daily Rate");
  if (adr) {
    result.adr = toCents(adr.ptdActual);
    result.adr_budget = toCents(adr.ptdBudget);
    result.adr_py = toCents(adr.ptdLY);
  }

  const revpar = parseRow("Revenue per Avl Room");
  if (revpar) {
    result.revpar = toCents(revpar.ptdActual);
    result.revpar_budget = toCents(revpar.ptdBudget);
    result.revpar_py = toCents(revpar.ptdLY);
  }

  const roomsOcc = parseRow("Rooms Occupied");
  if (roomsOcc) result.rooms_sold = roomsOcc.ptdActual ? Math.round(roomsOcc.ptdActual) : null;

  const roomsAvail = parseRow("Rooms Available");
  if (roomsAvail) result.rooms_available = roomsAvail.ptdActual ? Math.round(roomsAvail.ptdActual) : null;

  // Revenue
  const roomSales = parseRow("Room Sales");
  if (roomSales) {
    result.room_revenue = toCents(roomSales.ptdActual);
    result.room_revenue_budget = toCents(roomSales.ptdBudget);
    result.room_revenue_py = toCents(roomSales.ptdLY);
    result.room_revenue_ytd = toCents(roomSales.ytdActual);
  }

  // F&B = Restaurant + Lounge
  const restaurant = parseRow("Restaurant Sales");
  const lounge = parseRow("Lounge Sales");
  const fbRev = (restaurant?.ptdActual ?? 0) + (lounge?.ptdActual ?? 0);
  const fbRevBudget = (restaurant?.ptdBudget ?? 0) + (lounge?.ptdBudget ?? 0);
  const fbRevPY = (restaurant?.ptdLY ?? 0) + (lounge?.ptdLY ?? 0);
  result.fb_revenue = toCents(fbRev || null);
  result.fb_revenue_budget = toCents(fbRevBudget || null);
  result.fb_revenue_py = toCents(fbRevPY || null);

  // Other operated revenue
  const guestComm = parseRow("Guest Communications");
  result.other_operated_revenue = toCents(guestComm?.ptdActual ?? null);

  // Other/Misc income
  const otherIncome = parseRow("Other Income");
  result.misc_income = toCents(otherIncome?.ptdActual ?? null);

  // Total revenue
  const totalSales = parseRow("Total Sales");
  if (totalSales) {
    result.total_revenue = toCents(totalSales.ptdActual);
    result.total_revenue_budget = toCents(totalSales.ptdBudget);
    result.total_revenue_py = toCents(totalSales.ptdLY);
    result.total_revenue_ytd = toCents(totalSales.ytdActual);
    result.total_revenue_ytd_budget = toCents(totalSales.ytdBudget);
  }

  // Departmental Expenses
  const roomExp = parseRow("Room Expense");
  if (roomExp) {
    result.rooms_expense = toCents(roomExp.ptdActual);
    result.rooms_expense_budget = toCents(roomExp.ptdBudget);
  }

  const restExp = parseRow("Restaurant Expense");
  const loungeExp = parseRow("Lounge Expense");
  const fbExp = (restExp?.ptdActual ?? 0) + (loungeExp?.ptdActual ?? 0);
  const fbExpBudget = (restExp?.ptdBudget ?? 0) + (loungeExp?.ptdBudget ?? 0);
  result.fb_expense = toCents(fbExp || null);
  result.fb_expense_budget = toCents(fbExpBudget || null);

  const otherExp = parseRow("Other Expense");
  result.other_operated_expense = toCents(otherExp?.ptdActual ?? null);

  // Undistributed
  const adminGen = parseRow("Admin & General");
  if (adminGen) {
    result.admin_general = toCents(adminGen.ptdActual);
    result.admin_general_budget = toCents(adminGen.ptdBudget);
  }

  const advPromo = parseRow("Adv. & Promotion");
  if (advPromo) {
    result.sales_marketing = toCents(advPromo.ptdActual);
    result.sales_marketing_budget = toCents(advPromo.ptdBudget);
  }

  const infoTel = parseRow("Info and Telecom");
  if (infoTel) result.it_telecom = toCents(infoTel.ptdActual);

  const util = parseRow("Utilities");
  if (util) {
    result.utilities = toCents(util.ptdActual);
    result.utilities_budget = toCents(util.ptdBudget);
  }

  const maint = parseRow("Maintenance & Repair");
  if (maint) {
    result.property_ops_maintenance = toCents(maint.ptdActual);
    result.property_ops_maintenance_budget = toCents(maint.ptdBudget);
  }

  // GOP
  const gop = parseRow("G O P");
  if (gop) {
    result.gross_operating_profit = toCents(gop.ptdActual);
    result.gop_budget = toCents(gop.ptdBudget);
    result.gop_py = toCents(gop.ptdLY);
    result.gop_ytd = toCents(gop.ytdActual);
    result.gop_ytd_budget = toCents(gop.ytdBudget);
    result.gop_pct = gop.ptdActualPct ? pctToDecimal(gop.ptdActualPct) : null;
    result.gop_pct_budget = gop.ptdBudgetPct ? pctToDecimal(gop.ptdBudgetPct) : null;
  }

  // Fixed charges
  const mgmtFee = parseRow("MANAGEMENT FEE");
  if (mgmtFee) result.management_fees = toCents(mgmtFee.ptdActual);

  const propTax = parseRow("PROPERTY TAX");
  if (propTax) result.property_taxes = toCents(propTax.ptdActual);

  const insurance = parseRow("INSURANCE");
  if (insurance) result.insurance = toCents(insurance.ptdActual);

  const reserve = parseRow("RESERVE FUND");
  if (reserve) result.reserve_for_replacement = toCents(reserve.ptdActual);

  // NOP
  // Look for various NOP labels
  let nop = parseRow("NET OPERATING PROFIT") || parseRow("N O P") || parseRow("NOP");
  if (nop) {
    result.nop_hotel = toCents(nop.ptdActual);
    result.nop_hotel_budget = toCents(nop.ptdBudget);
    result.nop_hotel_py = toCents(nop.ptdLY);
    result.nop_hotel_ytd = toCents(nop.ytdActual);
    result.nop_hotel_ytd_budget = toCents(nop.ytdBudget);
    result.nop_pct = nop.ptdActualPct ? pctToDecimal(nop.ptdActualPct) : null;
    result.nop_pct_budget = nop.ptdBudgetPct ? pctToDecimal(nop.ptdBudgetPct) : null;
  }

  // Calculate NOP% if we have the values
  if (result.nop_hotel && result.total_revenue && !result.nop_pct) {
    result.nop_pct = result.nop_hotel / result.total_revenue;
  }
  if (result.gross_operating_profit && result.total_revenue && !result.gop_pct) {
    result.gop_pct = result.gross_operating_profit / result.total_revenue;
  }

  return result;
}
