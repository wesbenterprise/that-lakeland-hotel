"use client";

import { MonthlyPeriod } from "@/lib/types";
import { formatCurrency, formatPct, cn } from "@/lib/utils";

interface RowDef {
  label: string;
  actualKey: keyof MonthlyPeriod;
  budgetKey?: keyof MonthlyPeriod;
  pyKey?: keyof MonthlyPeriod;
  isExpense?: boolean;
  isTotal?: boolean;
  isSub?: boolean;
}

const rows: RowDef[] = [
  { label: "Room Revenue", actualKey: "room_revenue", budgetKey: "room_revenue_budget", pyKey: "room_revenue_py" },
  { label: "F&B Revenue", actualKey: "fb_revenue", budgetKey: "fb_revenue_budget", pyKey: "fb_revenue_py" },
  { label: "Other Revenue", actualKey: "other_operated_revenue" },
  { label: "Total Revenue", actualKey: "total_revenue", budgetKey: "total_revenue_budget", pyKey: "total_revenue_py", isTotal: true },
  { label: "Rooms Expense", actualKey: "rooms_expense", budgetKey: "rooms_expense_budget", isExpense: true, isSub: true },
  { label: "F&B Expense", actualKey: "fb_expense", budgetKey: "fb_expense_budget", isExpense: true, isSub: true },
  { label: "GOP", actualKey: "gross_operating_profit", budgetKey: "gop_budget", pyKey: "gop_py", isTotal: true },
  { label: "Admin & General", actualKey: "admin_general", budgetKey: "admin_general_budget", isExpense: true, isSub: true },
  { label: "Sales & Marketing", actualKey: "sales_marketing", budgetKey: "sales_marketing_budget", isExpense: true, isSub: true },
  { label: "Prop Ops & Maint", actualKey: "property_ops_maintenance", budgetKey: "property_ops_maintenance_budget", isExpense: true, isSub: true },
  { label: "Utilities", actualKey: "utilities", budgetKey: "utilities_budget", isExpense: true, isSub: true },
  { label: "Management Fees", actualKey: "management_fees", isExpense: true, isSub: true },
  { label: "NOP Hotel", actualKey: "nop_hotel", budgetKey: "nop_hotel_budget", pyKey: "nop_hotel_py", isTotal: true },
];

export function SummaryTable({ period }: { period: MonthlyPeriod }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 text-slate-400">
            <th className="text-left py-2 px-3 font-medium">Line Item</th>
            <th className="text-right py-2 px-3 font-medium">Actual</th>
            <th className="text-right py-2 px-3 font-medium">Budget</th>
            <th className="text-right py-2 px-3 font-medium">Var ($)</th>
            <th className="text-right py-2 px-3 font-medium">Var (%)</th>
            <th className="text-right py-2 px-3 font-medium">Prior Year</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const actual = period[row.actualKey] as number | null;
            const budget = row.budgetKey ? (period[row.budgetKey] as number | null) : null;
            const py = row.pyKey ? (period[row.pyKey] as number | null) : null;

            let varDollar: number | null = null;
            let varPct: number | null = null;
            let favorable: boolean | null = null;

            if (actual != null && budget != null && budget !== 0) {
              varDollar = actual - budget;
              varPct = varDollar / Math.abs(budget);
              favorable = row.isExpense ? varDollar <= 0 : varDollar >= 0;
            }

            return (
              <tr
                key={row.label}
                className={cn(
                  "border-b border-slate-700/50",
                  row.isTotal && "bg-slate-800/80 font-semibold"
                )}
              >
                <td className={cn("py-2 px-3", row.isSub && "pl-6 text-slate-300")}>
                  {row.label}
                </td>
                <td className="text-right py-2 px-3 font-mono">
                  {formatCurrency(actual)}
                </td>
                <td className="text-right py-2 px-3 font-mono text-slate-400">
                  {budget != null ? formatCurrency(budget) : "—"}
                </td>
                <td
                  className={cn(
                    "text-right py-2 px-3 font-mono",
                    favorable === true && "text-emerald-400",
                    favorable === false && "text-red-400"
                  )}
                >
                  {varDollar != null ? formatCurrency(varDollar) : "—"}
                </td>
                <td
                  className={cn(
                    "text-right py-2 px-3 font-mono",
                    favorable === true && "text-emerald-400",
                    favorable === false && "text-red-400"
                  )}
                >
                  {varPct != null ? `${(varPct * 100).toFixed(1)}%` : "—"}
                </td>
                <td className="text-right py-2 px-3 font-mono text-slate-400">
                  {py != null ? formatCurrency(py) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
