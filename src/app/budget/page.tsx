"use client";

import { useMemo, useState, Component, type ReactNode } from "react";

// ─── Error Boundary ──────────────────────────────────────────────────────────
class SectionErrorBoundary extends Component<{ children: ReactNode; label: string }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; label: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-xs text-slate-500">
          {this.props.label} — data unavailable
        </div>
      );
    }
    return this.props.children;
  }
}
import { useMonthlyData } from "@/lib/hooks";
import { MonthlyPeriod } from "@/lib/types";
import {
  formatCurrency, formatPct, monthName, fullMonthName, cn, aggregateByYear,
} from "@/lib/utils";
import type { YearSummary } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Cell, ComposedChart, Line,
  Legend,
} from "recharts";

// ─── MarginCompressionCallout ─────────────────────────────────────────────────

function MarginCompressionCallout({ data }: { data: MonthlyPeriod[] }) {
  const summaries = useMemo(() => aggregateByYear(data), [data]);

  const byYear = useMemo(() => {
    const m = new Map<number, YearSummary>();
    for (const s of summaries) m.set(s.year, s);
    return m;
  }, [summaries]);

  const y2023 = byYear.get(2023);
  const y2025 = byYear.get(2025);

  // Need at least 2023 and 2025 to render this callout
  if (!y2023 || !y2025) {
    // Fallback: try 2023 vs whatever the most recent year is
    const sorted = summaries.filter((s) => s.revenue > 0).sort((a, b) => a.year - b.year);
    if (sorted.length < 2) return null;
  }

  const base = y2023;
  const latest = y2025 ?? summaries.filter((s) => s.revenue > 0).sort((a, b) => b.year - a.year)[0];
  if (!base || !latest) return null;

  // Use annualized values if either year is partial (apples-to-apples)
  const baseRev = base.isPartial ? base.annualizedRevenue : base.revenue;
  const latestRev = latest.isPartial ? latest.annualizedRevenue : latest.revenue;
  const baseExp = base.isPartial ? base.annualizedExpense : base.expense;
  const latestExp = latest.isPartial ? latest.annualizedExpense : latest.expense;

  const revGrowthPct = baseRev > 0 ? ((latestRev - baseRev) / Math.abs(baseRev)) * 100 : null;
  const expGrowthPct = baseExp > 0 ? ((latestExp - baseExp) / Math.abs(baseExp)) * 100 : null;

  const baseNopPct = base.nopPct * 100;
  const latestNopPct = latest.nopPct * 100;
  const marginDelta = latestNopPct - baseNopPct;

  const baseYearLabel = `${base.year}${base.isPartial ? "*" : ""}`;
  const latestYearLabel = `${latest.year}${latest.isPartial ? "*" : ""}`;

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-amber-400 font-semibold text-sm">Margin Compression Summary</span>
        <span className="text-slate-500 text-xs">
          {baseYearLabel} → {latestYearLabel}
        </span>
        {(base.isPartial || latest.isPartial) && (
          <span className="text-xs text-amber-500 border border-amber-500/40 rounded px-1.5 py-0.5">
            ⚠ Partial year data — annualized
          </span>
        )}
      </div>

      {/* Three stat columns */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Revenue Growth */}
        <div className="text-center">
          <p className="text-xs text-slate-400 mb-1">Revenue Growth</p>
          {revGrowthPct !== null ? (
            <p className="text-2xl font-bold text-emerald-400">
              {revGrowthPct >= 0 ? "+" : ""}{revGrowthPct.toFixed(1)}%
            </p>
          ) : (
            <p className="text-2xl font-bold text-slate-500">—</p>
          )}
          <p className="text-xs text-slate-500 mt-0.5">{baseYearLabel} → {latestYearLabel}</p>
        </div>

        {/* Expense Growth */}
        <div className="text-center">
          <p className="text-xs text-slate-400 mb-1">Expense Growth</p>
          {expGrowthPct !== null ? (
            <p className="text-2xl font-bold text-red-400">
              {expGrowthPct >= 0 ? "+" : ""}{expGrowthPct.toFixed(1)}%
            </p>
          ) : (
            <p className="text-2xl font-bold text-slate-500">—</p>
          )}
          <p className="text-xs text-slate-500 mt-0.5">{baseYearLabel} → {latestYearLabel}</p>
        </div>

        {/* Margin Delta */}
        <div className="text-center">
          <p className="text-xs text-slate-400 mb-1">NOP Margin Δ</p>
          <p className="text-2xl font-bold text-red-400">
            {marginDelta >= 0 ? "+" : ""}{marginDelta.toFixed(1)}pp
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {baseNopPct.toFixed(1)}% → {latestNopPct.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Narrative */}
      <p className="text-sm text-slate-300 border-t border-amber-500/20 pt-3">
        Revenue{" "}
        {revGrowthPct !== null ? (
          <span className="text-emerald-400 font-semibold">
            {revGrowthPct >= 0 ? "+" : ""}{revGrowthPct.toFixed(1)}%
          </span>
        ) : "—"}{" "}
        since {base.year}{latest.isPartial ? "*" : ""}, but total operating expenses{" "}
        {expGrowthPct !== null ? (
          <span className="text-red-400 font-semibold">
            {expGrowthPct >= 0 ? "+" : ""}{expGrowthPct.toFixed(1)}%
          </span>
        ) : "—"}
        . NOP margin has compressed{" "}
        <span className="text-red-400 font-semibold">
          {marginDelta.toFixed(1)}pp
        </span>{" "}
        — from{" "}
        <span className="text-slate-200">{baseNopPct.toFixed(1)}%</span> to{" "}
        <span className="text-slate-200">{latestNopPct.toFixed(1)}%</span>.
      </p>

      {(base.isPartial || latest.isPartial) && (
        <p className="text-xs text-amber-500/70 mt-2">
          * Partial year — values annualized ({latest.isPartial ? `${latest.months} months` : `${base.months} months`})
        </p>
      )}
    </div>
  );
}

// ─── ThreeYearTrendChart ──────────────────────────────────────────────────────

interface TrendDatum {
  year: string;
  revenue: number;   // dollars (already / 100)
  expense: number;
  nopPct: number;    // 0..100
  months: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 shadow-lg">
      <p className="font-semibold text-slate-100 mb-2">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-medium tabular-nums">
            {p.name === "NOP Margin %"
              ? `${p.value.toFixed(1)}%`
              : `$${(p.value / 1000).toFixed(0)}K`}
          </span>
        </div>
      ))}
    </div>
  );
}

function ThreeYearTrendChart({ data }: { data: MonthlyPeriod[] }) {
  const summaries = useMemo(() => aggregateByYear(data), [data]);

  const chartData: TrendDatum[] = useMemo(() => {
    return [2023, 2024, 2025]
      .map((yr) => {
        const s = summaries.find((x) => x.year === yr);
        if (!s || s.revenue === 0) return null;
        return {
          year: s.isPartial ? `${yr}*` : String(yr),
          revenue: s.revenue / 100,
          expense: s.expense / 100,
          nopPct: s.nopPct * 100,
          months: s.months,
        };
      })
      .filter((d): d is TrendDatum => d !== null);
  }, [summaries]);

  const partialYears = chartData.filter((d) => d.year.endsWith("*"));

  if (chartData.length === 0) return null;

  const maxDollar = Math.max(...chartData.map((d) => Math.max(d.revenue, d.expense)));
  const dollarTickFmt = (v: number) =>
    Math.abs(v) >= 1_000_000
      ? `$${(v / 1_000_000).toFixed(1)}M`
      : `$${(v / 1_000).toFixed(0)}K`;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-200">3-Year Revenue & Expense Trend</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          NOP margin compression — revenue growing, expenses growing faster
        </p>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="99%" height={288}>
          <ComposedChart
            data={chartData}
            barCategoryGap="30%"
            barGap={8}
            margin={{ top: 8, right: 48, left: 16, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="year" stroke="#94a3b8" fontSize={12} tick={{ fill: "#94a3b8" }} />
            {/* Left Y-axis — dollars */}
            <YAxis
              yAxisId="dollars"
              orientation="left"
              stroke="#94a3b8"
              fontSize={11}
              tickFormatter={dollarTickFmt}
              domain={[0, "auto"]}
              tick={{ fill: "#94a3b8" }}
            />
            {/* Right Y-axis — percent */}
            <YAxis
              yAxisId="pct"
              orientation="right"
              stroke="#f59e0b"
              fontSize={11}
              tickFormatter={(v: number) => `${v.toFixed(1)}%`}
              domain={[0, 40]}
              tick={{ fill: "#f59e0b" }}
            />
            <Tooltip content={<TrendTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Legend
              wrapperStyle={{ fontSize: "11px", color: "#94a3b8", paddingTop: "8px" }}
            />
            <Bar
              yAxisId="dollars"
              dataKey="revenue"
              name="Total Revenue"
              fill="#3b82f6"
              radius={[3, 3, 0, 0]}
            />
            <Bar
              yAxisId="dollars"
              dataKey="expense"
              name="Total Expense"
              fill="#f87171"
              radius={[3, 3, 0, 0]}
            />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="nopPct"
              name="NOP Margin %"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ fill: "#f59e0b", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {partialYears.length > 0 && (
        <p className="text-xs text-slate-500 mt-2">
          {partialYears.map((d) => `* ${d.year.replace("*", "")} — partial year data (${d.months} months)`).join(" · ")}
        </p>
      )}
    </div>
  );
}

// ─── YTDPivotTable ────────────────────────────────────────────────────────────

interface PivotRow {
  label: string;
  isPercent?: boolean;
  isBold?: boolean;
  isExpense?: boolean;       // flip favorable logic
  ytdActual: number | null;
  ytdBudget: number | null;
  ytdPY: number | null;
}

function fmtPivotCell(val: number | null, isPercent: boolean): string {
  if (val === null) return "—";
  if (isPercent) return `${(val * 100).toFixed(1)}%`;
  return formatCurrency(val, true);        // abbreviated, in cents already
}

function VsCell({
  actual, ref: refVal, isPercent, isExpense,
}: {
  actual: number | null;
  ref: number | null;
  isPercent?: boolean;
  isExpense?: boolean;
}) {
  if (actual === null || refVal === null) {
    return <td className="px-3 py-2 text-center text-slate-600 tabular-nums text-xs">—</td>;
  }

  let delta: number;
  let label: string;
  if (isPercent) {
    // percentage-point difference
    delta = (actual - refVal) * 100;
    label = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}pp`;
  } else {
    const pct = refVal !== 0 ? ((actual - refVal) / Math.abs(refVal)) * 100 : 0;
    delta = actual - refVal;
    label = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
  }

  // Favorable: revenue/profit → actual > ref is good. Expense → actual < ref is good.
  const favorable = isExpense ? delta <= 0 : delta >= 0;

  return (
    <td
      className={cn(
        "px-3 py-2 text-center tabular-nums text-xs font-medium",
        favorable ? "text-emerald-400" : "text-red-400"
      )}
    >
      {label}
    </td>
  );
}

function YTDPivotTable({ data }: { data: MonthlyPeriod[] }) {
  // Detect current year and latest month
  const currentYear = useMemo(() => {
    if (data.length === 0) return new Date().getFullYear();
    return data[data.length - 1].year;
  }, [data]);

  const ytdPeriods = useMemo(
    () => data.filter((d) => d.year === currentYear).sort((a, b) => a.month - b.month),
    [data, currentYear]
  );

  const latestPeriod = ytdPeriods[ytdPeriods.length - 1];

  const priorYear = currentYear - 1;
  const priorYearPeriods = useMemo(
    () =>
      data
        .filter((d) => d.year === priorYear && d.month <= (latestPeriod?.month ?? 12))
        .sort((a, b) => a.month - b.month),
    [data, priorYear, latestPeriod]
  );

  if (!latestPeriod || ytdPeriods.length === 0) return null;

  const throughLabel = `Jan–${fullMonthName(latestPeriod.month)} ${currentYear}`;

  // ── Helper sums ──────────────────────────────────────────────────────────────
  const sumField = (periods: MonthlyPeriod[], field: keyof MonthlyPeriod) =>
    periods.reduce((acc, p) => acc + ((p[field] as number | null) ?? 0), 0);

  // YTD Actual — prefer _ytd columns, fall back to sum
  const ytdRevActual   = latestPeriod.total_revenue_ytd   ?? sumField(ytdPeriods, "total_revenue");
  const ytdRoomRevActual = latestPeriod.room_revenue_ytd  ?? sumField(ytdPeriods, "room_revenue");
  const ytdFbRevActual   = sumField(ytdPeriods, "fb_revenue");  // no _ytd column for fb
  const ytdGopActual   = latestPeriod.gop_ytd             ?? sumField(ytdPeriods, "gross_operating_profit");
  const ytdGopPct      = latestPeriod.gop_pct_ytd         ?? (ytdRevActual > 0 ? ytdGopActual / ytdRevActual : null);
  const ytdNopActual   = latestPeriod.nop_hotel_ytd       ?? sumField(ytdPeriods, "nop_hotel");
  const ytdNopPct      = latestPeriod.nop_pct_ytd         ?? (ytdRevActual > 0 ? ytdNopActual / ytdRevActual : null);

  // YTD expense actuals — sum monthlies
  const ytdRoomsExp    = sumField(ytdPeriods, "rooms_expense");
  const ytdFbExp       = sumField(ytdPeriods, "fb_expense");
  const ytdAG          = sumField(ytdPeriods, "admin_general");
  const ytdSM          = sumField(ytdPeriods, "sales_marketing");
  const ytdPropOps     = sumField(ytdPeriods, "property_ops_maintenance");
  const ytdUtil        = sumField(ytdPeriods, "utilities");

  // YTD Budget — prefer _ytd budget columns, fall back to sum monthly budgets
  const ytdRevBudget   = latestPeriod.total_revenue_ytd_budget ?? sumField(ytdPeriods, "total_revenue_budget");
  const ytdGopBudget   = latestPeriod.gop_ytd_budget           ?? sumField(ytdPeriods, "gop_budget");
  const ytdNopBudget   = latestPeriod.nop_hotel_ytd_budget     ?? sumField(ytdPeriods, "nop_hotel_budget");
  const ytdGopPctBudget = latestPeriod.gop_pct_budget; // use the last month's budget pct as proxy
  const ytdNopPctBudget = latestPeriod.nop_pct_budget;

  // Per-expense YTD budgets (monthlies summed)
  const ytdRoomsExpBudget = sumField(ytdPeriods, "rooms_expense_budget") || null;
  const ytdFbExpBudget    = sumField(ytdPeriods, "fb_expense_budget") || null;
  const ytdAGBudget       = sumField(ytdPeriods, "admin_general_budget") || null;
  const ytdSMBudget       = sumField(ytdPeriods, "sales_marketing_budget") || null;
  const ytdPropOpsBudget  = sumField(ytdPeriods, "property_ops_maintenance_budget") || null;
  const ytdUtilBudget     = sumField(ytdPeriods, "utilities_budget") || null;

  // Room/FB revenue budgets (no YTD budget cols — sum monthlies)
  const ytdRoomRevBudget  = sumField(ytdPeriods, "room_revenue_budget") || null;
  const ytdFbRevBudget    = sumField(ytdPeriods, "fb_revenue_budget") || null;

  // Prior Year (same-period sum from PY monthly rows)
  const ytdRevPY       = priorYearPeriods.length > 0 ? sumField(priorYearPeriods, "total_revenue") : null;
  const ytdRoomRevPY   = priorYearPeriods.length > 0 ? sumField(priorYearPeriods, "room_revenue") : null;
  const ytdFbRevPY     = priorYearPeriods.length > 0 ? sumField(priorYearPeriods, "fb_revenue") : null;
  const ytdGopPY       = priorYearPeriods.length > 0 ? sumField(priorYearPeriods, "gross_operating_profit") : null;
  const ytdGopPctPY    = (ytdRevPY && ytdGopPY !== null && ytdRevPY > 0) ? ytdGopPY / ytdRevPY : null;
  const ytdNopPY       = priorYearPeriods.length > 0 ? sumField(priorYearPeriods, "nop_hotel") : null;
  const ytdNopPctPY    = (ytdRevPY && ytdNopPY !== null && ytdRevPY > 0) ? ytdNopPY / ytdRevPY : null;
  const ytdRoomsExpPY  = priorYearPeriods.length > 0 ? sumField(priorYearPeriods, "rooms_expense") : null;
  const ytdFbExpPY     = priorYearPeriods.length > 0 ? sumField(priorYearPeriods, "fb_expense") : null;
  const ytdAGPY        = priorYearPeriods.length > 0 ? sumField(priorYearPeriods, "admin_general") : null;
  const ytdSMPY        = priorYearPeriods.length > 0 ? sumField(priorYearPeriods, "sales_marketing") : null;
  const ytdPropOpsPY   = priorYearPeriods.length > 0 ? sumField(priorYearPeriods, "property_ops_maintenance") : null;
  const ytdUtilPY      = priorYearPeriods.length > 0 ? sumField(priorYearPeriods, "utilities") : null;

  // ── Rows ─────────────────────────────────────────────────────────────────────
  const rows: PivotRow[] = [
    { label: "Total Revenue",   ytdActual: ytdRevActual,     ytdBudget: ytdRevBudget || null,     ytdPY: ytdRevPY },
    { label: "Room Revenue",    ytdActual: ytdRoomRevActual, ytdBudget: ytdRoomRevBudget,          ytdPY: ytdRoomRevPY },
    { label: "F&B Revenue",     ytdActual: ytdFbRevActual,   ytdBudget: ytdFbRevBudget,            ytdPY: ytdFbRevPY },
    { label: "Rooms Expense",   ytdActual: ytdRoomsExp,      ytdBudget: ytdRoomsExpBudget,         ytdPY: ytdRoomsExpPY, isExpense: true },
    { label: "Admin & General", ytdActual: ytdAG,            ytdBudget: ytdAGBudget,               ytdPY: ytdAGPY,       isExpense: true },
    { label: "Sales & Marketing", ytdActual: ytdSM,          ytdBudget: ytdSMBudget,               ytdPY: ytdSMPY,       isExpense: true },
    { label: "Property Ops",    ytdActual: ytdPropOps,       ytdBudget: ytdPropOpsBudget,          ytdPY: ytdPropOpsPY,  isExpense: true },
    { label: "Utilities",       ytdActual: ytdUtil,          ytdBudget: ytdUtilBudget,             ytdPY: ytdUtilPY,     isExpense: true },
    { label: "GOP",             ytdActual: ytdGopActual,     ytdBudget: ytdGopBudget || null,      ytdPY: ytdGopPY,      isBold: true },
    { label: "GOP %",           ytdActual: ytdGopPct,        ytdBudget: ytdGopPctBudget,           ytdPY: ytdGopPctPY,   isPercent: true },
    { label: "NOP",             ytdActual: ytdNopActual,     ytdBudget: ytdNopBudget || null,      ytdPY: ytdNopPY,      isBold: true },
    { label: "NOP %",           ytdActual: ytdNopPct,        ytdBudget: ytdNopPctBudget,           ytdPY: ytdNopPctPY,   isPercent: true },
  ];

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-200">YTD Performance Summary</h3>
        <p className="text-xs text-slate-400 mt-0.5">{throughLabel}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-3 py-2 text-slate-400 w-40">Metric</th>
              <th className="text-right px-3 py-2 text-slate-400">YTD Actual</th>
              <th className="text-right px-3 py-2 text-slate-400">YTD Budget</th>
              <th className="text-center px-3 py-2 text-slate-400">vs Budget</th>
              <th className="text-right px-3 py-2 text-slate-400">Prior Year</th>
              <th className="text-center px-3 py-2 text-slate-400">vs PY</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSection = row.label === "GOP" || row.label === "NOP";
              return (
                <tr
                  key={row.label}
                  className={cn(
                    "border-t",
                    isSection ? "border-slate-600 bg-slate-700/30" : "border-slate-700/50"
                  )}
                >
                  <td
                    className={cn(
                      "px-3 py-2 text-slate-300",
                      row.isBold ? "font-semibold" : "font-normal"
                    )}
                  >
                    {row.label}
                  </td>
                  {/* YTD Actual */}
                  <td className="px-3 py-2 text-right text-slate-200 tabular-nums font-medium">
                    {fmtPivotCell(row.ytdActual, row.isPercent ?? false)}
                  </td>
                  {/* YTD Budget */}
                  <td className="px-3 py-2 text-right text-slate-400 tabular-nums">
                    {fmtPivotCell(row.ytdBudget, row.isPercent ?? false)}
                  </td>
                  {/* vs Budget */}
                  <VsCell
                    actual={row.ytdActual}
                    ref={row.ytdBudget}
                    isPercent={row.isPercent}
                    isExpense={row.isExpense}
                  />
                  {/* Prior Year */}
                  <td className="px-3 py-2 text-right text-slate-400 tabular-nums">
                    {fmtPivotCell(row.ytdPY, row.isPercent ?? false)}
                  </td>
                  {/* vs PY */}
                  <VsCell
                    actual={row.ytdActual}
                    ref={row.ytdPY}
                    isPercent={row.isPercent}
                    isExpense={row.isExpense}
                  />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── YTD Scorecard ───────────────────────────────────────────────────────────

function YTDScorecard({ data, year }: { data: MonthlyPeriod[]; year: number }) {
  const ytdPeriods = data.filter((d) => d.year === year);
  if (ytdPeriods.length === 0) return null;
  const latest = ytdPeriods[ytdPeriods.length - 1];

  const sumRevenue = ytdPeriods.reduce((s, p) => s + (p.total_revenue ?? 0), 0);
  const sumGop = ytdPeriods.reduce((s, p) => s + (p.gross_operating_profit ?? 0), 0);
  const sumNop = ytdPeriods.reduce((s, p) => s + (p.nop_hotel ?? 0), 0);

  const budgetRevenue = latest.total_revenue_ytd_budget ?? 0;
  const budgetGop = latest.gop_ytd_budget ?? 0;
  const budgetNop = latest.nop_hotel_ytd_budget ?? 0;

  const metrics = [
    { label: "YTD Revenue", actual: sumRevenue, budget: budgetRevenue, format: "currency" as const },
    { label: "YTD GOP", actual: sumGop, budget: budgetGop, format: "currency" as const },
    { label: "YTD NOP", actual: sumNop, budget: budgetNop, format: "currency" as const },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {metrics.map(({ label, actual, budget }) => {
        const pct = budget > 0 ? (actual - budget) / Math.abs(budget) : null;
        const favorable = pct !== null && pct >= 0;
        const attainmentPct = budget > 0 ? Math.min(actual / budget, 1.5) : 0;

        return (
          <div key={label} className="bg-slate-800 rounded-lg border border-slate-700 p-5">
            <p className="text-xs text-slate-400 mb-1">{label}</p>
            <p className="text-2xl font-bold text-slate-100 mb-1">
              {formatCurrency(actual, true)}
            </p>
            <p className="text-xs text-slate-500 mb-3">
              Budget: {formatCurrency(budget, true)}
            </p>
            {/* Simple gauge bar */}
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", favorable ? "bg-emerald-500" : "bg-red-500")}
                style={{ width: `${Math.min(attainmentPct * 100, 100)}%` }}
              />
            </div>
            {pct !== null && (
              <p className={cn("text-sm font-semibold mt-2", favorable ? "text-emerald-400" : "text-red-400")}>
                {favorable ? "+" : ""}{(pct * 100).toFixed(1)}% vs budget
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Monthly Variance Chart ───────────────────────────────────────────────────

type VarMetric = "total_revenue" | "gross_operating_profit" | "nop_hotel";
const VAR_LABELS: Record<VarMetric, string> = {
  total_revenue: "Total Revenue",
  gross_operating_profit: "GOP",
  nop_hotel: "NOP",
};
const VAR_BUDGETS: Record<VarMetric, keyof MonthlyPeriod> = {
  total_revenue: "total_revenue_budget",
  gross_operating_profit: "gop_budget",
  nop_hotel: "nop_hotel_budget",
};

function MonthlyVarianceChart({ data, year }: { data: MonthlyPeriod[]; year: number }) {
  const [metric, setMetric] = useState<VarMetric>("nop_hotel");

  const chartData = useMemo(() => {
    return data
      .filter((d) => d.year === year)
      .map((d) => {
        const actual = (d[metric] as number | null) ?? 0;
        const budget = (d[VAR_BUDGETS[metric]] as number | null) ?? 0;
        const variance = actual - budget;
        const variancePct = budget !== 0 ? (variance / Math.abs(budget)) * 100 : 0;
        return {
          month: monthName(d.month),
          variance: variance / 100, // dollars
          variancePct,
          favorable: variance >= 0,
        };
      });
  }, [data, year, metric]);

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">Monthly Budget Variance</h3>
        <div className="flex gap-1">
          {(Object.keys(VAR_LABELS) as VarMetric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={cn(
                "px-3 py-1 text-xs rounded-md",
                metric === m ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              )}
            >
              {VAR_LABELS[m]}
            </button>
          ))}
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
            <YAxis
              stroke="#94a3b8"
              fontSize={11}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.06)" }}
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#e2e8f0",
              }}
              formatter={(value: number) => [`$${(value / 1000).toFixed(0)}K`, "Variance vs Budget"]}
            />
            <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />
            <Bar dataKey="variance" radius={[3, 3, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.favorable ? "#10b981" : "#ef4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Budget Hit Rate ──────────────────────────────────────────────────────────

function BudgetHitRate({ data }: { data: MonthlyPeriod[] }) {
  const stats = useMemo(() => {
    const ttm = data.slice(-12);
    if (ttm.length === 0) return null;

    const metrics: Record<string, { hits: number; total: number }> = {
      Revenue: { hits: 0, total: 0 },
      GOP: { hits: 0, total: 0 },
      NOP: { hits: 0, total: 0 },
    };

    for (const p of ttm) {
      if (p.total_revenue !== null && p.total_revenue_budget !== null) {
        metrics.Revenue.total++;
        if (p.total_revenue >= p.total_revenue_budget) metrics.Revenue.hits++;
      }
      if (p.gross_operating_profit !== null && p.gop_budget !== null) {
        metrics.GOP.total++;
        if (p.gross_operating_profit >= p.gop_budget) metrics.GOP.hits++;
      }
      if (p.nop_hotel !== null && p.nop_hotel_budget !== null) {
        metrics.NOP.total++;
        if (p.nop_hotel >= p.nop_hotel_budget) metrics.NOP.hits++;
      }
    }

    return metrics;
  }, [data]);

  if (!stats) return null;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-4">
        Rolling 12-Month Budget Hit Rate
      </h3>
      <div className="space-y-4">
        {Object.entries(stats).map(([label, { hits, total }]) => {
          if (total === 0) return null;
          const pct = hits / total;
          return (
            <div key={label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300">{label}</span>
                <span className={cn("font-semibold", pct >= 0.5 ? "text-emerald-400" : "text-red-400")}>
                  {hits} of {total} months ({(pct * 100).toFixed(0)}%)
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", pct >= 0.67 ? "bg-emerald-500" : pct >= 0.5 ? "bg-yellow-400" : "bg-red-500")}
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Expense Heatmap ──────────────────────────────────────────────────────────

interface ExpenseCategory {
  label: string;
  actual: keyof MonthlyPeriod;
  budget: keyof MonthlyPeriod;
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { label: "Rooms Expense", actual: "rooms_expense", budget: "rooms_expense_budget" },
  { label: "F&B Expense", actual: "fb_expense", budget: "fb_expense_budget" },
  { label: "Admin & General", actual: "admin_general", budget: "admin_general_budget" },
  { label: "Sales & Marketing", actual: "sales_marketing", budget: "sales_marketing_budget" },
  { label: "Property Ops", actual: "property_ops_maintenance", budget: "property_ops_maintenance_budget" },
  { label: "Utilities", actual: "utilities", budget: "utilities_budget" },
];

function ExpenseHeatmap({ data, year }: { data: MonthlyPeriod[]; year: number }) {
  const ytdPeriods = data.filter((d) => d.year === year);

  if (ytdPeriods.length === 0) return null;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-4">
        Expense Budget Adherence — {year} YTD
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-2 py-2 text-slate-400 w-36">Category</th>
              {ytdPeriods.map((p) => (
                <th key={p.period} className="px-2 py-2 text-center text-slate-400 min-w-[50px]">
                  {monthName(p.month)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EXPENSE_CATEGORIES.map(({ label, actual, budget }) => (
              <tr key={label} className="border-t border-slate-700/50">
                <td className="px-2 py-2 text-slate-300 font-medium">{label}</td>
                {ytdPeriods.map((p) => {
                  const a = p[actual] as number | null;
                  const b = p[budget] as number | null;
                  if (a == null || b == null || b === 0) {
                    return <td key={p.period} className="px-2 py-2 text-center text-slate-600">—</td>;
                  }
                  const ratio = (a - b) / Math.abs(b);
                  let bg = "bg-slate-700";
                  if (ratio < -0.05) bg = "bg-emerald-500/30 text-emerald-300";
                  else if (ratio < 0.03) bg = "bg-yellow-500/20 text-yellow-300";
                  else bg = "bg-red-500/30 text-red-300";

                  return (
                    <td key={p.period} className={cn("px-2 py-2 text-center tabular-nums rounded", bg)}>
                      {ratio >= 0 ? "+" : ""}{(ratio * 100).toFixed(0)}%
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500 mt-2">
        🟢 Under budget &nbsp; 🟡 Within 3% &nbsp; 🔴 Over budget
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const { data, loading, error } = useMonthlyData();

  const currentYear = useMemo(() => {
    if (data.length === 0) return new Date().getFullYear();
    return data[data.length - 1].year;
  }, [data]);

  const [year, setYear] = useState<number | null>(null);
  const selectedYear = year ?? currentYear;

  const availableYears = useMemo(() => {
    const years = Array.from(new Set(data.map((d) => d.year))).sort((a, b) => b - a);
    return years;
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl animate-pulse">
        <div className="h-8 bg-slate-700 rounded w-48" />
        <div className="h-28 bg-slate-800 rounded-lg border border-amber-500/20" />
        <div className="h-72 bg-slate-800 rounded-lg border border-slate-700" />
        <div className="h-48 bg-slate-800 rounded-lg border border-slate-700" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-slate-800 rounded-lg border border-slate-700" />)}
        </div>
        <div className="h-64 bg-slate-800 rounded-lg border border-slate-700" />
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="text-slate-400 text-center mt-20">
        {error ?? "No data available."}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Budget Performance</h1>
          <p className="text-sm text-slate-400 mt-1">Actual vs budget analysis — SpringHill Suites Lakeland</p>
        </div>
        <select
          value={selectedYear}
          onChange={(e) => setYear(Number(e.target.value))}
          className="bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-md px-3 py-1.5"
        >
          {availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* NEW: Margin Compression Callout */}
      <SectionErrorBoundary label="Margin Compression Summary">
        <MarginCompressionCallout data={data} />
      </SectionErrorBoundary>

      {/* NEW: 3-Year Trend Chart */}
      <SectionErrorBoundary label="3-Year Trend Chart">
        <ThreeYearTrendChart data={data} />
      </SectionErrorBoundary>

      {/* NEW: YTD Pivot Table */}
      <SectionErrorBoundary label="YTD Pivot Table">
        <YTDPivotTable data={data} />
      </SectionErrorBoundary>

      {/* EXISTING: YTD Scorecard */}
      <YTDScorecard data={data} year={selectedYear} />

      {/* EXISTING: Monthly Variance Chart */}
      <MonthlyVarianceChart data={data} year={selectedYear} />

      {/* EXISTING: Budget Hit Rate + Expense Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BudgetHitRate data={data} />
        <ExpenseHeatmap data={data} year={selectedYear} />
      </div>
    </div>
  );
}
