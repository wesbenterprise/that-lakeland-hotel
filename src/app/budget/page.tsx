"use client";

import { useMemo, useState } from "react";
import { useMonthlyData } from "@/lib/hooks";
import { MonthlyPeriod } from "@/lib/types";
import { formatCurrency, formatPct, monthName, fullMonthName, cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Cell,
} from "recharts";

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
      {metrics.map(({ label, actual, budget, format }) => {
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
                  // Red = over budget, green = under budget (expense context)
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

      {/* YTD Scorecard */}
      <YTDScorecard data={data} year={selectedYear} />

      {/* Monthly Variance Chart */}
      <MonthlyVarianceChart data={data} year={selectedYear} />

      {/* Budget Hit Rate + Expense Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BudgetHitRate data={data} />
        <ExpenseHeatmap data={data} year={selectedYear} />
      </div>
    </div>
  );
}
