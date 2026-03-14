/**
 * McKibbon Income Statement XLSX Parser
 * For when XLSX format income statements are available.
 * Uses the same mapping config as PDF parser.
 */

import * as XLSX from "xlsx";
import { MonthlyPeriod } from "./types";

/** Parse a dollar amount to cents */
function toCents(val: unknown): number | null {
  if (val == null || val === "" || val === "-") return null;
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/[$,()]/g, ""));
  if (isNaN(num)) return null;
  return Math.round(num * 100);
}

/** Parse a percentage to decimal */
function toPct(val: unknown): number | null {
  if (val == null || val === "" || val === "-") return null;
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/%/g, ""));
  if (isNaN(num)) return null;
  // XLSX often stores percentages as decimals already (0.75 for 75%)
  return num > 1 ? num / 100 : num;
}

/** Parse integer */
function toInt(val: unknown): number | null {
  if (val == null || val === "" || val === "-") return null;
  const num = typeof val === "number" ? val : parseInt(String(val).replace(/[,]/g, ""));
  if (isNaN(num)) return null;
  return Math.round(num);
}

/** Extract period from filename (e.g., "Lakeland SHS Income Statement 02-2026.xlsx") */
function extractPeriodFromFilename(filename: string): { year: number; month: number; period: string } | null {
  const match = filename.match(/(\d{2})-(\d{4})/);
  if (!match) return null;
  const month = parseInt(match[1]);
  const year = parseInt(match[2]);
  return { year, month, period: `${year}-${String(month).padStart(2, "0")}-01` };
}

/** Parse XLSX buffer into MonthlyPeriod data */
export function parseMcKibbonXLSX(buffer: Buffer, filename: string): Partial<MonthlyPeriod> {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  
  // Convert to array of arrays for easier row scanning
  const data: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  
  const periodInfo = extractPeriodFromFilename(filename);
  
  const result: Partial<MonthlyPeriod> = {
    period: periodInfo?.period,
    year: periodInfo?.year,
    month: periodInfo?.month,
    source_file: filename,
  };

  // Find rows by label matching (scan column A or the label column)
  const findRow = (label: string): (string | number | null)[] | null => {
    for (const row of data) {
      if (!row) continue;
      for (let c = 0; c < Math.min(row.length, 15); c++) {
        const cell = String(row[c] ?? "").trim();
        if (cell.toLowerCase().includes(label.toLowerCase())) {
          return row;
        }
      }
    }
    return null;
  };

  // Determine column layout - look for header row
  // Standard: PTD Budget | PTD Budget % | PTD Budget POR | PTD | PTD % | PTD POR | PTD LY | ...
  // Or: The item column might be the first, with data to the right
  
  // Try to detect layout
  let labelCol = 0;
  let ptdBudgetCol = 1;
  let ptdActualCol = 4;
  let ptdLYCol = 7;
  let ytdBudgetCol = 10;
  let ytdActualCol = 13;
  
  // Check if the McKibbon format puts labels in middle
  for (const row of data) {
    if (!row) continue;
    const rowStr = row.map(c => String(c ?? "")).join(" ").toLowerCase();
    if (rowStr.includes("ptd budget") || rowStr.includes("ptd actual")) {
      // Found header row — determine column positions
      for (let c = 0; c < row.length; c++) {
        const h = String(row[c] ?? "").toLowerCase().trim();
        if (h === "item" || h === "description") labelCol = c;
      }
      break;
    }
  }

  // Parse operating stats
  const occupancyRow = findRow("Occupancy");
  if (occupancyRow) {
    result.occupancy_pct = toPct(occupancyRow[ptdActualCol]);
    result.occupancy_pct_budget = toPct(occupancyRow[ptdBudgetCol]);
    result.occupancy_pct_py = toPct(occupancyRow[ptdLYCol]);
  }

  const adrRow = findRow("Average Daily Rate");
  if (adrRow) {
    result.adr = toCents(adrRow[ptdActualCol]);
    result.adr_budget = toCents(adrRow[ptdBudgetCol]);
    result.adr_py = toCents(adrRow[ptdLYCol]);
  }

  const revparRow = findRow("RevPAR") || findRow("Revenue per Avl");
  if (revparRow) {
    result.revpar = toCents(revparRow[ptdActualCol]);
    result.revpar_budget = toCents(revparRow[ptdBudgetCol]);
    result.revpar_py = toCents(revparRow[ptdLYCol]);
  }

  const roomsSold = findRow("Rooms Occupied") || findRow("Rooms Sold");
  if (roomsSold) result.rooms_sold = toInt(roomsSold[ptdActualCol]);

  const roomsAvail = findRow("Rooms Available");
  if (roomsAvail) result.rooms_available = toInt(roomsAvail[ptdActualCol]);

  // Revenue
  const roomSales = findRow("Room Sales") || findRow("Room Revenue");
  if (roomSales) {
    result.room_revenue = toCents(roomSales[ptdActualCol]);
    result.room_revenue_budget = toCents(roomSales[ptdBudgetCol]);
    result.room_revenue_py = toCents(roomSales[ptdLYCol]);
    result.room_revenue_ytd = toCents(roomSales[ytdActualCol]);
  }

  const totalSales = findRow("Total Sales") || findRow("Total Revenue");
  if (totalSales) {
    result.total_revenue = toCents(totalSales[ptdActualCol]);
    result.total_revenue_budget = toCents(totalSales[ptdBudgetCol]);
    result.total_revenue_py = toCents(totalSales[ptdLYCol]);
    result.total_revenue_ytd = toCents(totalSales[ytdActualCol]);
    result.total_revenue_ytd_budget = toCents(totalSales[ytdBudgetCol]);
  }

  // F&B
  const restSales = findRow("Restaurant Sales");
  const loungeSales = findRow("Lounge Sales");
  const fbRev = (toCents(restSales?.[ptdActualCol]) ?? 0) + (toCents(loungeSales?.[ptdActualCol]) ?? 0);
  result.fb_revenue = fbRev || null;
  const fbBud = (toCents(restSales?.[ptdBudgetCol]) ?? 0) + (toCents(loungeSales?.[ptdBudgetCol]) ?? 0);
  result.fb_revenue_budget = fbBud || null;

  // Departmental Expenses
  const roomExp = findRow("Room Expense");
  if (roomExp) {
    result.rooms_expense = toCents(roomExp[ptdActualCol]);
    result.rooms_expense_budget = toCents(roomExp[ptdBudgetCol]);
  }

  // Undistributed
  const admin = findRow("Admin & General");
  if (admin) {
    result.admin_general = toCents(admin[ptdActualCol]);
    result.admin_general_budget = toCents(admin[ptdBudgetCol]);
  }

  const advPromo = findRow("Adv. & Promotion") || findRow("Sales & Marketing");
  if (advPromo) {
    result.sales_marketing = toCents(advPromo[ptdActualCol]);
    result.sales_marketing_budget = toCents(advPromo[ptdBudgetCol]);
  }

  const maint = findRow("Maintenance & Repair") || findRow("Property Operations");
  if (maint) {
    result.property_ops_maintenance = toCents(maint[ptdActualCol]);
    result.property_ops_maintenance_budget = toCents(maint[ptdBudgetCol]);
  }

  const util = findRow("Utilities");
  if (util) {
    result.utilities = toCents(util[ptdActualCol]);
    result.utilities_budget = toCents(util[ptdBudgetCol]);
  }

  const telecom = findRow("Info and Telecom");
  if (telecom) result.it_telecom = toCents(telecom[ptdActualCol]);

  // Profit lines
  const gop = findRow("G O P") || findRow("Gross Operating Profit");
  if (gop) {
    result.gross_operating_profit = toCents(gop[ptdActualCol]);
    result.gop_budget = toCents(gop[ptdBudgetCol]);
    result.gop_py = toCents(gop[ptdLYCol]);
    result.gop_ytd = toCents(gop[ytdActualCol]);
    result.gop_ytd_budget = toCents(gop[ytdBudgetCol]);
    result.gop_pct = toPct(gop[ptdActualCol + 1]);
    result.gop_pct_budget = toPct(gop[ptdBudgetCol + 1]);
  }

  const mgmt = findRow("MANAGEMENT FEE") || findRow("Management Fee");
  if (mgmt) result.management_fees = toCents(mgmt[ptdActualCol]);

  const propTax = findRow("PROPERTY TAX") || findRow("Property Tax");
  if (propTax) result.property_taxes = toCents(propTax[ptdActualCol]);

  const ins = findRow("INSURANCE") || findRow("Insurance");
  if (ins) result.insurance = toCents(ins[ptdActualCol]);

  const reserve = findRow("RESERVE") || findRow("FF&E");
  if (reserve) result.reserve_for_replacement = toCents(reserve[ptdActualCol]);

  // NOP
  const nop = findRow("NET OPERATING") || findRow("N O P") || findRow("NOP");
  if (nop) {
    result.nop_hotel = toCents(nop[ptdActualCol]);
    result.nop_hotel_budget = toCents(nop[ptdBudgetCol]);
    result.nop_hotel_py = toCents(nop[ptdLYCol]);
    result.nop_hotel_ytd = toCents(nop[ytdActualCol]);
    result.nop_hotel_ytd_budget = toCents(nop[ytdBudgetCol]);
  }

  // Calculate percentages
  if (result.gross_operating_profit && result.total_revenue) {
    result.gop_pct = result.gop_pct ?? result.gross_operating_profit / result.total_revenue;
  }
  if (result.nop_hotel && result.total_revenue) {
    result.nop_pct = result.nop_hotel / result.total_revenue;
  }

  return result;
}
