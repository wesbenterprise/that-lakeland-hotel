/**
 * Batch upload: parse all 68 months of SHS Lakeland financial data
 * and upsert into Supabase monthly_periods table.
 *
 * Strategy:
 * 1. Try Trial Balance XLSX (handles both "Trial_Balance" and "Trial Balance" naming)
 * 2. Fall back to Income Statement PDF via pdf-parse
 *
 * Usage:
 *   npx tsx scripts/batch-upload.ts                  # all months
 *   npx tsx scripts/batch-upload.ts --pdf-only       # re-run PDF-only months (force income statement)
 */

import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import { createClient } from "@supabase/supabase-js";
import { parseMcKibbonXLSX } from "../src/lib/xlsx-parser";
import { parseMcKibbonPDF } from "../src/lib/pdf-parser";

const SUPABASE_URL = "https://qrryydgpujoumgotemfk.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY env var");
  process.exit(1);
}

const SOURCE_DIR =
  "/Users/wrbopenclaw/.openclaw/workspace-ace/projects/shs-financials";

// Months where Trial Balance XLSX is missing or PDF-only — must use Income Statement PDF
const PDF_ONLY_MONTHS = new Set([
  // Missing usable Trial Balance entirely
  "2022-09", "2022-10", "2023-01", "2023-02",
  // Apr 2023 through Jan 2026: only have Trial Balance PDF (no XLSX)
  "2023-04", "2023-05", "2023-06", "2023-07", "2023-08", "2023-09",
  "2023-10", "2023-11", "2023-12",
  "2024-01", "2024-02", "2024-03", "2024-04", "2024-05", "2024-06",
  "2024-07", "2024-08", "2024-09", "2024-10", "2024-11", "2024-12",
  "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06",
  "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
  "2026-01",
]);

const pdfOnlyMode = process.argv.includes("--pdf-only");

async function parseIncomeStatementPDF(
  dirPath: string,
  files: string[],
  periodKey: string
): Promise<{ record: any; filename: string }> {
  const incomePdf = files.find(
    (f) => f.toLowerCase().includes("income statement") && f.endsWith(".pdf")
  );
  if (!incomePdf) throw new Error("No Income Statement PDF found");

  const buf = fs.readFileSync(path.join(dirPath, incomePdf));
  const data = await pdfParse(buf);
  const record = parseMcKibbonPDF(data.text, incomePdf);

  // Always set period from directory name for consistency
  const [y, m] = periodKey.split("-");
  record.period = `${y}-${m}-01`;
  record.year = parseInt(y);
  record.month = parseInt(m);
  record.source_file = incomePdf;

  return { record, filename: incomePdf };
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY!);

  // Collect all month directories, sorted
  let dirs = fs
    .readdirSync(SOURCE_DIR)
    .filter((d) => /^\d{4}-\d{2}\s/.test(d))
    .sort();

  // In --pdf-only mode, only process the affected months
  if (pdfOnlyMode) {
    dirs = dirs.filter((d) => PDF_ONLY_MONTHS.has(d.slice(0, 7)));
    console.log(`PDF-only mode: re-processing ${dirs.length} affected months\n`);
  } else {
    console.log(`Found ${dirs.length} month directories\n`);
  }

  let succeeded = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const dir of dirs) {
    const periodKey = dir.slice(0, 7); // "2022-01"
    const dirPath = path.join(SOURCE_DIR, dir);

    try {
      const files = fs.readdirSync(dirPath);
      const forcePdf = PDF_ONLY_MONTHS.has(periodKey);

      // 1. Try Trial Balance XLSX (skip if this month is known PDF-only)
      if (!forcePdf) {
        const trialXlsx = files.find(
          (f) =>
            /trial.?balance/i.test(f) && f.endsWith(".xlsx")
        );

        if (trialXlsx) {
          const buf = fs.readFileSync(path.join(dirPath, trialXlsx));
          const record = parseMcKibbonXLSX(buf, trialXlsx);
          if (!record.period) {
            const [y, m] = periodKey.split("-");
            record.period = `${y}-${m}-01`;
            record.year = parseInt(y);
            record.month = parseInt(m);
          }
          const { error } = await supabase
            .from("monthly_periods")
            .upsert(record, { onConflict: "period" });
          if (error) throw new Error(error.message);
          console.log(`✓ ${periodKey} (xlsx)`);
          succeeded++;
          continue;
        }
      }

      // 2. Use Income Statement PDF (forced for PDF_ONLY_MONTHS, fallback for others)
      const { record, filename } = await parseIncomeStatementPDF(dirPath, files, periodKey);
      const { error } = await supabase
        .from("monthly_periods")
        .upsert(record, { onConflict: "period" });
      if (error) throw new Error(error.message);
      console.log(`✓ ${periodKey} (pdf: ${filename})`);
      succeeded++;
    } catch (e: any) {
      console.log(`✗ ${periodKey}: ${e.message}`);
      failed++;
      failures.push(`${periodKey}: ${e.message}`);
    }
  }

  // Summary
  console.log(`\n--- Summary ---`);
  console.log(`${succeeded} succeeded, ${failed} failed`);
  if (failures.length) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(`  ${f}`));
  }

  // Show DB state
  const { data: rows } = await supabase
    .from("monthly_periods")
    .select("period")
    .order("period");
  if (rows?.length) {
    console.log(
      `\nDB now has ${rows.length} rows: ${rows[0].period} → ${rows[rows.length - 1].period}`
    );
  }
}

main().catch(console.error);
