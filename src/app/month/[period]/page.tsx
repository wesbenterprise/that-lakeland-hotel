"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMonthlyData } from "@/lib/hooks";
import { MonthlyPeriod } from "@/lib/types";
import { formatCurrency, formatPct, fullMonthName, cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";

/* ---------- USALI line definitions ---------- */
type LineType = "revenue" | "expense" | "subtotal" | "header" | "pct";

interface USALILine {
  label: string;
  type: LineType;
  actual: keyof MonthlyPeriod | null;
  budget: keyof MonthlyPeriod | null;
  py: keyof MonthlyPeriod | null;
  ytdActual: keyof MonthlyPeriod | null;
  ytdBudget: keyof MonthlyPeriod | null;
  indent?: number;
}

const LINES: USALILine[] = [
  { label: "REVENUE", type: "header", actual: null, budget: null, py: null, ytdActual: null, ytdBudget: null },
  { label: "Room Revenue", type: "revenue", actual: "room_revenue", budget: "room_revenue_budget", py: "room_revenue_py", ytdActual: "room_revenue_ytd", ytdBudget: null, indent: 1 },
  { label: "Food & Beverage Revenue", type: "revenue", actual: "fb_revenue", budget: "fb_revenue_budget", py: "fb_revenue_py", ytdActual: null, ytdBudget: null, indent: 1 },
  { label: "Other Operated Departments", type: "revenue", actual: "other_operated_revenue", budget: null, py: null, ytdActual: null, ytdBudget: null, indent: 1 },
  { label: "Miscellaneous Income", type: "revenue", actual: "misc_income", budget: null, py: null, ytdActual: null, ytdBudget: null, indent: 1 },
  { label: "TOTAL REVENUE", type: "subtotal", actual: "total_revenue", budget: "total_revenue_budget", py: "total_revenue_py", ytdActual: "total_revenue_ytd", ytdBudget: "total_revenue_ytd_budget" },

  { label: "DEPARTMENTAL EXPENSES", type: "header", actual: null, budget: null, py: null, ytdActual: null, ytdBudget: null },
  { label: "Rooms", type: "expense", actual: "rooms_expense", budget: "rooms_expense_budget", py: null, ytdActual: null, ytdBudget: null, indent: 1 },
  { label: "Food & Beverage", type: "expense", actual: "fb_expense", budget: "fb_expense_budget", py: null, ytdActual: null, ytdBudget: null, indent: 1 },
  { label: "Other Operated Departments", type: "expense", actual: "other_operated_expense", budget: null, py: null, ytdActual: null, ytdBudget: null, indent: 1 },

  { label: "UNDISTRIBUTED OPERATING EXPENSES", type: "header", actual: null, budget: null, py: null, ytdActual: null, ytdBudget: null },
  { label: "Administrative & General", type: "expense", actual: "admin_general", budget: "admin_general_budget", py: null, ytdActual: null, ytdBudget: null, indent: 1 },
  { label: "Sales & Marketing", type: "expense", actual: "sales_marketing", budget: "sales_marketing_budget", py: null, ytdActual: null, ytdBudget: null, indent: 1 },
  { label: "Property Operations & Maintenance", type: "expense", actual: "property_ops_maintenance", budget: "property_ops_maintenance_budget", py: null, ytdActual: null, ytdBudget: null, indent: 1 },
  { label: "Utilities", type: "expense", actual: "utilities", budget: "utilities_budget", py: null, ytdActual: null, ytdBudget: null, indent: 1 },
  { label: "Information & Telecom Systems", type: "expense", actual: "it_telecom", budget: null, py: null, ytdActual: null, ytdBudget: null, indent: 1 },

  { label: "GROSS OPERATING PROFIT", type: "subtotal", actual: "gross_operating_profit", budget: "gop_budget", py: "gop_py", ytdActual: "gop_ytd", ytdBudget: "gop_ytd_budget" },
  { label: "GOP %", type: "pct", actual: "gop_pct", budget: "gop_pct_budget", py: "gop_pct_py", ytdActual: "gop_pct_ytd", ytdBudget: null },

  { label: "Management Fees", type: "expense", actual: "management_fees", budget: null, py: null, ytdActual: null, ytdBudget: null, indent: 1 },
  { label: "Property Taxes", type: "expense", actual: "property_taxes", budget: null, py: null, ytdActual: null, ytdBudget: null, indent: 1 },
  { label: "Insurance", type: "expense", actual: "insurance", budget: null, py: null, ytdActual: null, ytdBudget: null, indent: 1 },
  { label: "FF&E Reserve", type: "expense", actual: "reserve_for_replacement", budget: null, py: null, ytdActual: null, ytdBudget: null, indent: 1 },

  { label: "NET OPERATING PROFIT (HOTEL)", type: "subtotal", actual: "nop_hotel", budget: "nop_hotel_budget", py: "nop_hotel_py", ytdActual: "nop_hotel_ytd", ytdBudget: "nop_hotel_ytd_budget" },
  { label: "NOP %", type: "pct", actual: "nop_pct", budget: "nop_pct_budget", py: "nop_pct_py", ytdActual: "nop_pct_ytd", ytdBudget: null },
];

/* ---------- Helpers ---------- */
function val(p: MonthlyPeriod, key: keyof MonthlyPeriod | null): number | null {
  if (!key) return null;
  const v = p[key];
  return typeof v === "number" ? v : null;
}

function varianceDollar(actual: number | null, budget: number | null): number | null {
  if (actual == null || budget == null) return null;
  return actual - budget;
}

function variancePct(actual: number | null, budget: number | null): number | null {
  if (actual == null || budget == null || budget === 0) return null;
  return (actual - budget) / Math.abs(budget);
}

function VarianceCell({ v, isExpense, isPct }: { v: number | null; isExpense: boolean; isPct?: boolean }) {
  if (v == null) return <td className="px-3 py-1.5 text-right text-slate-500">—</td>;
  const favorable = isExpense ? v <= 0 : v >= 0;
  const color = favorable ? "text-emerald-400" : "text-red-400";
  const bg = favorable ? "bg-emerald-500/5" : "bg-red-500/5";
  const display = isPct ? `${(v * 100).toFixed(1)}%` : formatCurrency(v);
  return (
    <td className={cn("px-3 py-1.5 text-right text-xs tabular-nums", color, bg)}>
      {v > 0 && !isPct ? "+" : ""}{display}
    </td>
  );
}

/* ---------- Component ---------- */
export default function MonthDetailPage() {
  const params = useParams();
  const router = useRouter();
  const periodSlug = params.period as string; // e.g. "2026-02"
  const { data, loading } = useMonthlyData();

  const { period, idx } = useMemo(() => {
    if (data.length === 0) return { period: null, idx: -1 };
    // Try matching slug format YYYY-MM
    const i = data.findIndex((d) => d.period.startsWith(periodSlug));
    if (i >= 0) return { period: data[i], idx: i };
    // Fallback: latest
    return { period: data[data.length - 1], idx: data.length - 1 };
  }, [data, periodSlug]);

  const goPrev = () => {
    if (idx > 0) {
      const p = data[idx - 1];
      router.push(`/month/${p.year}-${String(p.month).padStart(2, "0")}`);
    }
  };
  const goNext = () => {
    if (idx < data.length - 1) {
      const p = data[idx + 1];
      router.push(`/month/${p.year}-${String(p.month).padStart(2, "0")}`);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400 animate-pulse">Loading...</div>;
  }

  if (!period) {
    return <div className="text-slate-400 text-center mt-20">No data found for this period.</div>;
  }

  const p = period;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header with nav arrows */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={goPrev}
            disabled={idx <= 0}
            className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold">
            {fullMonthName(p.month)} {p.year}
          </h1>
          <button
            onClick={goNext}
            disabled={idx >= data.length - 1}
            className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Income Statement Table */}
        <div className="flex-1 bg-slate-800 rounded-lg border border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-xs text-slate-400 uppercase">
                <th className="px-3 py-2 text-left w-64">Line Item</th>
                <th className="px-3 py-2 text-right">PTD Actual</th>
                <th className="px-3 py-2 text-right">PTD Budget</th>
                <th className="px-3 py-2 text-right">Var $</th>
                <th className="px-3 py-2 text-right">Var %</th>
                <th className="px-3 py-2 text-right">Prior Year</th>
                <th className="px-3 py-2 text-right">YTD Actual</th>
                <th className="px-3 py-2 text-right">YTD Budget</th>
              </tr>
            </thead>
            <tbody>
              {LINES.map((line, i) => {
                const isHeader = line.type === "header";
                const isSubtotal = line.type === "subtotal";
                const isPctLine = line.type === "pct";
                const isExpense = line.type === "expense";

                if (isHeader) {
                  return (
                    <tr key={i} className="border-t border-slate-700/50">
                      <td colSpan={8} className="px-3 py-2 text-xs font-bold text-slate-400 uppercase pt-4">
                        {line.label}
                      </td>
                    </tr>
                  );
                }

                const actual = val(p, line.actual);
                const budget = val(p, line.budget);
                const py = val(p, line.py);
                const ytdA = val(p, line.ytdActual);
                const ytdB = val(p, line.ytdBudget);

                const fmt = isPctLine ? formatPct : (v: number | null) => formatCurrency(v);
                const varD = isPctLine ? null : varianceDollar(actual, budget);
                const varP = variancePct(actual, budget);

                return (
                  <tr
                    key={i}
                    className={cn(
                      "border-t border-slate-700/30 hover:bg-slate-700/20",
                      isSubtotal && "bg-slate-700/20 font-semibold"
                    )}
                  >
                    <td className={cn("px-3 py-1.5 text-slate-200", line.indent && `pl-${3 + line.indent * 4}`, isSubtotal && "font-bold")}>
                      {line.label}
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs tabular-nums">{fmt(actual)}</td>
                    <td className="px-3 py-1.5 text-right text-xs tabular-nums text-slate-400">{fmt(budget)}</td>
                    <VarianceCell v={varD} isExpense={isExpense || line.label.includes("Fee") || line.label.includes("Tax") || line.label.includes("Insurance") || line.label.includes("Reserve")} />
                    <VarianceCell v={varP} isExpense={isExpense || line.label.includes("Fee") || line.label.includes("Tax") || line.label.includes("Insurance") || line.label.includes("Reserve")} isPct />
                    <td className="px-3 py-1.5 text-right text-xs tabular-nums text-slate-400">{fmt(py)}</td>
                    <td className="px-3 py-1.5 text-right text-xs tabular-nums">{isPctLine ? formatPct(ytdA) : formatCurrency(ytdA)}</td>
                    <td className="px-3 py-1.5 text-right text-xs tabular-nums text-slate-400">{isPctLine ? formatPct(ytdB) : formatCurrency(ytdB)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Operating Stats Panel */}
        <div className="xl:w-72 bg-slate-800 rounded-lg border border-slate-700 p-4 h-fit">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Operating Statistics</h3>
          <div className="space-y-3">
            {[
              { label: "Rooms Available", actual: p.rooms_available, budget: null, py: null, fmt: (v: number | null) => v?.toLocaleString() ?? "—" },
              { label: "Rooms Sold", actual: p.rooms_sold, budget: null, py: null, fmt: (v: number | null) => v?.toLocaleString() ?? "—" },
              { label: "Occupancy %", actual: p.occupancy_pct, budget: p.occupancy_pct_budget, py: p.occupancy_pct_py, fmt: formatPct },
              { label: "ADR", actual: p.adr, budget: p.adr_budget, py: p.adr_py, fmt: (v: number | null) => formatCurrency(v) },
              { label: "RevPAR", actual: p.revpar, budget: p.revpar_budget, py: p.revpar_py, fmt: (v: number | null) => formatCurrency(v) },
            ].map((stat) => (
              <div key={stat.label} className="border-b border-slate-700/50 pb-2">
                <div className="text-xs text-slate-400 mb-1">{stat.label}</div>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-semibold text-slate-100">{stat.fmt(stat.actual)}</span>
                  <div className="text-xs text-slate-500 space-x-2">
                    {stat.budget != null && <span>B: {stat.fmt(stat.budget)}</span>}
                    {stat.py != null && <span>PY: {stat.fmt(stat.py)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
