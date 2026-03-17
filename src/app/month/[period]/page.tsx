"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMonthlyData } from "@/lib/hooks";
import { MonthlyPeriod } from "@/lib/types";
import { formatCurrency, formatPct, fullMonthName, cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Printer, TrendingUp, TrendingDown } from "lucide-react";

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

  { label: "FIXED CHARGES", type: "header", actual: null, budget: null, py: null, ytdActual: null, ytdBudget: null },
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

/* ---------- MoM Comparison Strip ---------- */
function ComparisonStrip({ current, prev, prevYear }: { current: MonthlyPeriod; prev: MonthlyPeriod | null; prevYear: MonthlyPeriod | null }) {
  const metrics = [
    { label: "Revenue", key: "total_revenue" as keyof MonthlyPeriod },
    { label: "GOP", key: "gross_operating_profit" as keyof MonthlyPeriod },
    { label: "NOP", key: "nop_hotel" as keyof MonthlyPeriod },
  ];

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 no-print">
      <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">Period Comparison</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 border-b border-slate-700">
              <th className="text-left pb-2 w-20" />
              <th className="text-right pb-2">This Month</th>
              {prev && <th className="text-right pb-2">Prior Month</th>}
              {prev && <th className="text-right pb-2">MoM Δ</th>}
              {prevYear && <th className="text-right pb-2">Same Mo LY</th>}
              {prevYear && <th className="text-right pb-2">YoY Δ</th>}
            </tr>
          </thead>
          <tbody>
            {metrics.map(({ label, key }) => {
              const curr = val(current, key);
              const prevVal = prev ? val(prev, key) : null;
              const pyVal = prevYear ? val(prevYear, key) : null;

              const momPct = curr !== null && prevVal !== null && prevVal !== 0
                ? (curr - prevVal) / Math.abs(prevVal) : null;
              const yoyPct = curr !== null && pyVal !== null && pyVal !== 0
                ? (curr - pyVal) / Math.abs(pyVal) : null;

              return (
                <tr key={label} className="border-t border-slate-700/30">
                  <td className="py-1.5 text-slate-300 font-medium">{label}</td>
                  <td className="py-1.5 text-right text-slate-200 tabular-nums">{formatCurrency(curr, true)}</td>
                  {prev && <td className="py-1.5 text-right text-slate-400 tabular-nums">{formatCurrency(prevVal, true)}</td>}
                  {prev && (
                    <td className={cn("py-1.5 text-right tabular-nums font-medium", momPct === null ? "text-slate-500" : momPct >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {momPct === null ? "—" : (
                        <span className="flex items-center justify-end gap-0.5">
                          {momPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {momPct >= 0 ? "+" : ""}{(momPct * 100).toFixed(1)}%
                        </span>
                      )}
                    </td>
                  )}
                  {prevYear && <td className="py-1.5 text-right text-slate-400 tabular-nums">{formatCurrency(pyVal, true)}</td>}
                  {prevYear && (
                    <td className={cn("py-1.5 text-right tabular-nums font-medium", yoyPct === null ? "text-slate-500" : yoyPct >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {yoyPct === null ? "—" : (
                        <span className="flex items-center justify-end gap-0.5">
                          {yoyPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {yoyPct >= 0 ? "+" : ""}{(yoyPct * 100).toFixed(1)}%
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Notes Component ---------- */
function PeriodNotes({ period }: { period: MonthlyPeriod }) {
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useMemo(() => {
    // Load existing note
    const fetchNote = async () => {
      try {
        const res = await fetch(`/api/notes?period=${period.period.slice(0, 7)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.note) {
            setSavedNote(json.note);
            setNote(json.note);
          }
        }
      } catch {}
      finally {
        setLoading(false);
      }
    };
    fetchNote();
  }, [period.period]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: period.period.slice(0, 10), note }),
      });
      if (res.ok) setSavedNote(note);
    } catch {}
    finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 no-print">
      <h3 className="text-sm font-semibold text-slate-300 mb-3">Notes & Commentary</h3>
      {loading ? (
        <div className="h-20 bg-slate-700 animate-pulse rounded" />
      ) : (
        <>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={`Add notes for ${fullMonthName(period.month)} ${period.year}... (e.g. "Strong spring training demand" or "McKibbon overspent on marketing")`}
            className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-500 resize-none h-24 focus:outline-none focus:border-emerald-500"
          />
          <div className="flex items-center justify-between mt-2">
            {savedNote && note === savedNote ? (
              <span className="text-xs text-emerald-500">✓ Saved</span>
            ) : (
              <span className="text-xs text-slate-500">{note !== savedNote ? "Unsaved changes" : ""}</span>
            )}
            <button
              onClick={save}
              disabled={saving || note === savedNote}
              className="px-3 py-1 text-xs rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white"
            >
              {saving ? "Saving..." : "Save Note"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Component ---------- */
export default function MonthDetailPage() {
  const params = useParams();
  const router = useRouter();
  const periodSlug = params.period as string;
  const { data, loading } = useMonthlyData();

  const { period, idx } = useMemo(() => {
    if (data.length === 0) return { period: null, idx: -1 };
    const i = data.findIndex((d) => d.period.startsWith(periodSlug));
    if (i >= 0) return { period: data[i], idx: i };
    return { period: data[data.length - 1], idx: data.length - 1 };
  }, [data, periodSlug]);

  // Previous month and same month prior year
  const prevPeriod = useMemo(() => idx > 0 ? data[idx - 1] : null, [data, idx]);
  const prevYearPeriod = useMemo(() => {
    if (!period) return null;
    return data.find((d) => d.year === period.year - 1 && d.month === period.month) ?? null;
  }, [data, period]);

  // Compute YTD client-side by summing all periods in the same year up to this month
  const ytdComputed = useMemo(() => {
    if (!period) return null;
    const ytdPeriods = data.filter((d) => d.year === period.year && d.month <= period.month);
    const sum = (key: keyof MonthlyPeriod) =>
      ytdPeriods.reduce((s, p) => s + ((p[key] as number | null) ?? 0), 0);
    return {
      total_revenue: sum("total_revenue"),
      gross_operating_profit: sum("gross_operating_profit"),
      nop_hotel: sum("nop_hotel"),
      room_revenue: sum("room_revenue"),
      rooms_sold: sum("rooms_sold"),
      rooms_available: sum("rooms_available"),
    };
  }, [data, period]);

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
    return (
      <div className="space-y-6 max-w-7xl animate-pulse">
        <div className="h-8 bg-slate-700 rounded w-56" />
        <div className="h-24 bg-slate-800 rounded-lg border border-slate-700" />
        <div className="h-96 bg-slate-800 rounded-lg border border-slate-700" />
      </div>
    );
  }

  if (!period) {
    return <div className="text-slate-400 text-center mt-20">No data found for this period.</div>;
  }

  const p = period;

  return (
    <div className="space-y-6 max-w-7xl print:space-y-4">
      {/* Print Header (hidden on screen) */}
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold text-black">SpringHill Suites Lakeland</h1>
        <h2 className="text-lg text-gray-600">{fullMonthName(p.month)} {p.year} — Income Statement</h2>
      </div>

      {/* Header with nav arrows */}
      <div className="flex items-center justify-between no-print">
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
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md transition-colors"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
      </div>

      {/* MoM + YoY Comparison Strip */}
      <ComparisonStrip current={p} prev={prevPeriod} prevYear={prevYearPeriod} />

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Income Statement Table */}
        <div className="flex-1 bg-slate-800 rounded-lg border border-slate-700 overflow-x-auto print:border-0 print:bg-white">
          <table className="w-full text-sm print:text-black">
            <thead>
              <tr className="border-b border-slate-700 text-xs text-slate-400 uppercase print:text-gray-500 print:border-gray-300">
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
                      <td colSpan={8} className="px-3 py-2 text-xs font-bold text-slate-400 uppercase pt-4 print:text-gray-600">
                        {line.label}
                      </td>
                    </tr>
                  );
                }

                const actual = val(p, line.actual);
                const budget = val(p, line.budget);
                const py = val(p, line.py);

                // YTD: prefer stored, fall back to computed
                let ytdA = val(p, line.ytdActual);
                if (ytdA == null && ytdComputed && line.actual) {
                  const k = line.actual as keyof typeof ytdComputed;
                  if (k in ytdComputed) ytdA = ytdComputed[k as keyof typeof ytdComputed] ?? null;
                }
                const ytdB = val(p, line.ytdBudget);

                const fmt = isPctLine ? formatPct : (v: number | null) => formatCurrency(v);
                const varD = isPctLine ? null : varianceDollar(actual, budget);
                const varP = variancePct(actual, budget);
                const isExpenseLike = isExpense || ["Management Fees", "Property Taxes", "Insurance", "FF&E Reserve"].includes(line.label);

                return (
                  <tr
                    key={i}
                    className={cn(
                      "border-t border-slate-700/30 hover:bg-slate-700/20",
                      isSubtotal && "bg-slate-700/20 font-semibold"
                    )}
                  >
                    <td className={cn(
                      "px-3 py-1.5 text-slate-200 print:text-gray-800",
                      line.indent && `pl-${3 + line.indent * 4}`,
                      isSubtotal && "font-bold"
                    )}>
                      {line.label}
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs tabular-nums">{fmt(actual)}</td>
                    <td className="px-3 py-1.5 text-right text-xs tabular-nums text-slate-400">{fmt(budget)}</td>
                    <VarianceCell v={varD} isExpense={isExpenseLike} />
                    <VarianceCell v={varP} isExpense={isExpenseLike} isPct />
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
        <div className="xl:w-72 bg-slate-800 rounded-lg border border-slate-700 p-4 h-fit print:border-gray-300">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Operating Statistics</h3>
          <div className="space-y-3">
            {[
              { label: "Rooms Available", actual: p.rooms_available, budget: null, py: null, fmt: (v: number | null) => v?.toLocaleString() ?? "—" },
              { label: "Rooms Sold", actual: p.rooms_sold, budget: null, py: null, fmt: (v: number | null) => v?.toLocaleString() ?? "—" },
              { label: "Occupancy %", actual: p.occupancy_pct, budget: p.occupancy_pct_budget, py: p.occupancy_pct_py, fmt: formatPct },
              { label: "ADR", actual: p.adr, budget: p.adr_budget, py: p.adr_py, fmt: (v: number | null) => formatCurrency(v) },
              { label: "RevPAR", actual: p.revpar, budget: p.revpar_budget, py: p.revpar_py, fmt: (v: number | null) => formatCurrency(v) },
              {
                label: "TRevPAR",
                actual: p.rooms_available && p.rooms_available > 0 && p.total_revenue
                  ? Math.round(p.total_revenue / p.rooms_available) : null,
                budget: null, py: null,
                fmt: (v: number | null) => formatCurrency(v),
              },
              {
                label: "GOPPAR",
                actual: p.rooms_available && p.rooms_available > 0 && p.gross_operating_profit
                  ? Math.round(p.gross_operating_profit / p.rooms_available) : null,
                budget: null, py: null,
                fmt: (v: number | null) => formatCurrency(v),
              },
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

          {/* YTD summary */}
          {ytdComputed && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <h4 className="text-xs font-semibold text-slate-400 mb-3">YTD Computed</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Revenue</span>
                  <span className="text-slate-200 tabular-nums">{formatCurrency(ytdComputed.total_revenue, true)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">GOP</span>
                  <span className="text-slate-200 tabular-nums">{formatCurrency(ytdComputed.gross_operating_profit, true)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">NOP</span>
                  <span className="text-slate-200 tabular-nums">{formatCurrency(ytdComputed.nop_hotel, true)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <PeriodNotes period={p} />
    </div>
  );
}
