/**
 * Validation script for McKibbon PDF Parser
 * Tests against known-correct values from February 2026 income statement.
 */

import * as fs from "fs";
import * as path from "path";

// Dynamic import for pdf-parse (CommonJS module)
async function main() {
  const pdfParse = require("pdf-parse");

  // Import parser
  const { parseMcKibbonPDF } = require("../src/lib/pdf-parser");

  const pdfPath = "/Users/wrbopenclaw/Downloads/Lakeland SHS Income Statement 02-2026.pdf";

  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF not found: ${pdfPath}`);
    process.exit(1);
  }

  console.log("=== McKibbon PDF Parser Validation ===");
  console.log(`File: ${pdfPath}\n`);

  const buffer = fs.readFileSync(pdfPath);
  const pdfData = await pdfParse(buffer);
  const parsed = parseMcKibbonPDF(pdfData.text, path.basename(pdfPath));

  // Debug: dump parsed values
  console.log("--- Parsed Result (key fields) ---");
  console.log(JSON.stringify({
    period: parsed.period,
    rooms_available: parsed.rooms_available,
    rooms_sold: parsed.rooms_sold,
    occupancy_pct: parsed.occupancy_pct,
    adr: parsed.adr,
    revpar: parsed.revpar,
    room_revenue: parsed.room_revenue,
    room_revenue_budget: parsed.room_revenue_budget,
    total_revenue: parsed.total_revenue,
    total_revenue_budget: parsed.total_revenue_budget,
    total_revenue_py: parsed.total_revenue_py,
    total_revenue_ytd: parsed.total_revenue_ytd,
    total_revenue_ytd_budget: parsed.total_revenue_ytd_budget,
    gross_operating_profit: parsed.gross_operating_profit,
    gop_budget: parsed.gop_budget,
    gop_py: parsed.gop_py,
    gop_pct: parsed.gop_pct,
    gop_ytd: parsed.gop_ytd,
    gop_ytd_budget: parsed.gop_ytd_budget,
    admin_general: parsed.admin_general,
    admin_general_budget: parsed.admin_general_budget,
    sales_marketing: parsed.sales_marketing,
    sales_marketing_budget: parsed.sales_marketing_budget,
    nop_hotel: parsed.nop_hotel,
    nop_hotel_budget: parsed.nop_hotel_budget,
    nop_hotel_py: parsed.nop_hotel_py,
    nop_hotel_ytd: parsed.nop_hotel_ytd,
    nop_hotel_ytd_budget: parsed.nop_hotel_ytd_budget,
    insurance: parsed.insurance,
  }, null, 2));
  console.log("");

  // ─── Validation Tests ───────────────────────────────────────────────────────

  let passed = 0;
  let failed = 0;

  function check(label: string, actual: number | null | undefined, expected: number, tolerance = 1) {
    const ok = actual != null && Math.abs(actual - expected) <= tolerance;
    if (ok) {
      passed++;
      console.log(`  ✅ PASS  ${label}: ${actual} (expected ${expected})`);
    } else {
      failed++;
      console.log(`  ❌ FAIL  ${label}: ${actual} (expected ${expected}, diff=${actual != null ? actual - expected : 'NULL'})`);
    }
  }

  function checkPct(label: string, actual: number | null | undefined, expectedPct: number, tolerance = 0.005) {
    // expectedPct is like 89.47 (percentage), actual should be decimal like 0.8947
    const expectedDecimal = expectedPct / 100;
    const ok = actual != null && Math.abs(actual - expectedDecimal) <= tolerance;
    if (ok) {
      passed++;
      console.log(`  ✅ PASS  ${label}: ${(actual! * 100).toFixed(2)}% (expected ${expectedPct}%)`);
    } else {
      failed++;
      console.log(`  ❌ FAIL  ${label}: ${actual != null ? (actual * 100).toFixed(2) + '%' : 'NULL'} (expected ${expectedPct}%, diff=${actual != null ? ((actual - expectedDecimal) * 100).toFixed(2) + 'pp' : 'NULL'})`);
    }
  }

  console.log("--- Period ---");
  check("Period year", parsed.year, 2026);
  check("Period month", parsed.month, 2);

  console.log("\n--- Rooms Available ---");
  check("Rooms Available (actual)", parsed.rooms_available, 3528);

  console.log("\n--- Rooms Sold ---");
  check("Rooms Sold (actual)", parsed.rooms_sold, 3148);

  console.log("\n--- Occupancy ---");
  checkPct("Occupancy Budget", parsed.occupancy_pct_budget, 89.47);
  checkPct("Occupancy Actual", parsed.occupancy_pct, 89.23);
  checkPct("Occupancy PY", parsed.occupancy_pct_py, 91.72);

  console.log("\n--- ADR ---");
  check("ADR Budget (cents)", parsed.adr_budget, 21638);
  check("ADR Actual (cents)", parsed.adr, 22116);
  check("ADR PY (cents)", parsed.adr_py, 21232);

  console.log("\n--- RevPAR ---");
  check("RevPAR Budget (cents)", parsed.revpar_budget, 19359);
  check("RevPAR Actual (cents)", parsed.revpar, 19734);
  check("RevPAR PY (cents)", parsed.revpar_py, 19474);

  console.log("\n--- Room Revenue ---");
  check("Room Revenue Budget (cents)", parsed.room_revenue_budget, 68298100);
  check("Room Revenue Actual (cents)", parsed.room_revenue, 69621600);
  check("Room Revenue PY (cents)", parsed.room_revenue_py, 68705800);

  console.log("\n--- Total Revenue ---");
  check("Total Revenue Budget (cents)", parsed.total_revenue_budget, 74256600);
  check("Total Revenue Actual (cents)", parsed.total_revenue, 77120200);
  check("Total Revenue PY (cents)", parsed.total_revenue_py, 75138400);

  console.log("\n--- YTD Total Revenue ---");
  check("YTD Total Revenue Budget (cents)", parsed.total_revenue_ytd_budget, 135731700);
  check("YTD Total Revenue Actual (cents)", parsed.total_revenue_ytd, 138949700);

  console.log("\n--- GOP ---");
  check("GOP Budget (cents)", parsed.gop_budget, 40952200);
  check("GOP Actual (cents)", parsed.gross_operating_profit, 46715300);
  check("GOP PY (cents)", parsed.gop_py, 46207400);
  checkPct("GOP% Budget", parsed.gop_pct_budget, 55.15);
  checkPct("GOP% Actual", parsed.gop_pct, 60.57);

  console.log("\n--- YTD GOP ---");
  check("YTD GOP Budget (cents)", parsed.gop_ytd_budget, 68905300);
  check("YTD GOP Actual (cents)", parsed.gop_ytd, 76966700);

  console.log("\n--- Admin & General ---");
  check("Admin & General Budget (cents)", parsed.admin_general_budget, 8969000);
  check("Admin & General Actual (cents)", parsed.admin_general, 7730200);

  console.log("\n--- Adv & Promotion ---");
  check("Adv & Promotion Budget (cents)", parsed.sales_marketing_budget, 7180000);
  check("Adv & Promotion Actual (cents)", parsed.sales_marketing, 5278600);

  console.log("\n--- Net Operating Profit ---");
  check("NOP Budget (cents)", parsed.nop_hotel_budget, 25071800);
  check("NOP Actual (cents)", parsed.nop_hotel, 31513200);
  check("NOP PY (cents)", parsed.nop_hotel_py, 31752300);

  console.log("\n--- YTD NOP ---");
  check("YTD NOP Budget (cents)", parsed.nop_hotel_ytd_budget, 39315500);
  check("YTD NOP Actual (cents)", parsed.nop_hotel_ytd, 50567200);

  console.log("\n--- Insurance (sum of 4 lines) ---");
  check("Insurance Actual (cents)", parsed.insurance, 3525000);

  // ─── Summary ────────────────────────────────────────────────────────────────

  const total = passed + failed;
  const pct = ((passed / total) * 100).toFixed(1);
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed}/${total} passed (${pct}%)`);
  if (failed > 0) {
    console.log(`⚠️  ${failed} field(s) FAILED validation`);
  } else {
    console.log("🎉 ALL FIELDS PASSED!");
  }
  console.log("=".repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
