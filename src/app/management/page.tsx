"use client";

import { useMemo } from "react";
import { useMonthlyData } from "@/lib/hooks";
import { MonthlyPeriod } from "@/lib/types";
import { formatCurrency, formatPct, monthName, cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, BarChart, Bar, Cell, ReferenceLine,
} from "recharts";

// ─── Expense Ratios Over Time ─────────────────────────────────────────────────

function ExpenseRatios({ data }: { data: MonthlyPeriod[] }) {
  const chartData = useMemo(() => {
    return data.slice(-24).map((d) => {
      const totalRev = d.total_revenue ?? 0;
      const roomRev = d.room_revenue ?? 0;
      const fbRev = d.fb_revenue ?? 0;

      return {
        name: `${monthName(d.month)} ${d.year}`,
        "Rooms Dept %": roomRev > 0 && d.rooms_expense ? ((d.rooms_expense / roomRev) * 100).toFixed(1) : null,
        "F&B Dept %": fbRev > 0 && d.fb_expense ? ((d.fb_expense / fbRev) * 100).toFixed(1) : null,
        "Admin %": totalRev > 0 && d.admin_general ? ((d.admin_general / totalRev) * 100).toFixed(1) : null,
        "Sales %": totalRev > 0 && d.sales_marketing ? ((d.sales_marketing / totalRev) * 100).toFixed(1) : null,
      };
    });
  }, [data]);

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-1">Expense Ratios Over Time</h3>
      <p className="text-xs text-slate-500 mb-4">Lower = McKibbon running tighter</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} angle={-45} textAnchor="end" height={55} />
            <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#e2e8f0" }}
              formatter={(v: number) => [`${v}%`]}
            />
            <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 11 }} />
            <Line type="monotone" dataKey="Rooms Dept %" stroke="#10b981" strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="F&B Dept %" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="Admin %" stroke="#a78bfa" strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="Sales %" stroke="#f97316" strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── GOP Flow-Through ─────────────────────────────────────────────────────────

function GOPFlowThrough({ data }: { data: MonthlyPeriod[] }) {
  const chartData = useMemo(() => {
    const result = [];
    for (let i = 12; i < data.length; i++) {
      const curr = data[i];
      const py = data[i - 12]; // same month prior year

      const revChange = (curr.total_revenue ?? 0) - (py.total_revenue ?? 0);
      const gopChange = (curr.gross_operating_profit ?? 0) - (py.gross_operating_profit ?? 0);

      if (revChange === 0) continue;
      const flowThrough = (gopChange / revChange) * 100;

      if (Math.abs(flowThrough) > 200) continue; // outlier filter

      result.push({
        name: `${monthName(curr.month)} ${curr.year}`,
        flowThrough: parseFloat(flowThrough.toFixed(1)),
        positive: flowThrough >= 0,
      });
    }
    return result.slice(-18);
  }, [data]);

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-1">GOP Flow-Through vs Prior Year</h3>
      <p className="text-xs text-slate-500 mb-4">% of incremental revenue that flows to GOP. &gt;50% = strong management.</p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} angle={-45} textAnchor="end" height={55} />
            <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#e2e8f0" }}
              formatter={(v: number) => [`${v}%`, "Flow-Through"]}
            />
            <ReferenceLine y={50} stroke="#10b981" strokeDasharray="4 2" strokeOpacity={0.6} label={{ value: "50% target", fill: "#10b981", fontSize: 10 }} />
            <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />
            <Bar dataKey="flowThrough" radius={[3, 3, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.positive ? "#10b981" : "#ef4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Expense Budget Adherence ─────────────────────────────────────────────────

interface ExpCat {
  label: string;
  actual: keyof MonthlyPeriod;
  budget: keyof MonthlyPeriod;
}

const EXP_CATS: ExpCat[] = [
  { label: "Rooms Expense", actual: "rooms_expense", budget: "rooms_expense_budget" },
  { label: "F&B Expense", actual: "fb_expense", budget: "fb_expense_budget" },
  { label: "Admin & General", actual: "admin_general", budget: "admin_general_budget" },
  { label: "Sales & Marketing", actual: "sales_marketing", budget: "sales_marketing_budget" },
  { label: "Property Ops", actual: "property_ops_maintenance", budget: "property_ops_maintenance_budget" },
  { label: "Utilities", actual: "utilities", budget: "utilities_budget" },
];

function ExpenseBudgetAdherence({ data }: { data: MonthlyPeriod[] }) {
  const ttm = data.slice(-12);

  const stats = useMemo(() => {
    return EXP_CATS.map(({ label, actual, budget }) => {
      let sumActual = 0;
      let sumBudget = 0;
      let count = 0;

      for (const p of ttm) {
        const a = p[actual] as number | null;
        const b = p[budget] as number | null;
        if (a != null && b != null) {
          sumActual += a;
          sumBudget += b;
          count++;
        }
      }

      if (count === 0) return null;
      const variance = sumBudget > 0 ? (sumActual - sumBudget) / Math.abs(sumBudget) : null;

      return { label, actual: sumActual, budget: sumBudget, variance, count };
    }).filter(Boolean);
  }, [ttm]);

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-1">Expense Budget Adherence</h3>
      <p className="text-xs text-slate-500 mb-4">Trailing 12 months — which categories is McKibbon over?</p>
      <div className="space-y-3">
        {stats.map((stat) => {
          if (!stat) return null;
          const { label, actual, budget, variance } = stat;
          const overBudget = variance !== null && variance > 0;
          return (
            <div key={label} className="border-b border-slate-700/50 pb-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300">{label}</span>
                {variance !== null && (
                  <span className={cn("font-semibold", overBudget ? "text-red-400" : "text-emerald-400")}>
                    {overBudget ? "+" : ""}{(variance * 100).toFixed(1)}% vs budget
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>Actual: {formatCurrency(actual, true)}</span>
                <span>Budget: {formatCurrency(budget, true)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Management Fee Summary ───────────────────────────────────────────────────

function ManagementFeeSummary({ data }: { data: MonthlyPeriod[] }) {
  const stats = useMemo(() => {
    const totalFees = data.reduce((s, p) => s + (p.management_fees ?? 0), 0);
    const totalRevenue = data.reduce((s, p) => s + (p.total_revenue ?? 0), 0);
    const avgFeeRate = totalRevenue > 0 ? totalFees / totalRevenue : 0;

    // By year
    const byYear: Record<number, { fees: number; revenue: number }> = {};
    for (const p of data) {
      if (!byYear[p.year]) byYear[p.year] = { fees: 0, revenue: 0 };
      byYear[p.year].fees += p.management_fees ?? 0;
      byYear[p.year].revenue += p.total_revenue ?? 0;
    }

    const yearRows = Object.entries(byYear)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([yr, { fees, revenue }]) => ({
        year: Number(yr),
        fees,
        revenue,
        feeRate: revenue > 0 ? fees / revenue : 0,
      }));

    return { totalFees, totalRevenue, avgFeeRate, yearRows };
  }, [data]);

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-1">Management Fee Summary</h3>
      <p className="text-xs text-slate-500 mb-4">Total fees paid to McKibbon Hospitality</p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-slate-400">Total Fees Paid</p>
          <p className="text-xl font-bold text-slate-100">{formatCurrency(stats.totalFees, true)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Avg Fee Rate</p>
          <p className="text-xl font-bold text-slate-100">{formatPct(stats.avgFeeRate)}</p>
          <p className="text-xs text-slate-500">of total revenue</p>
        </div>
      </div>

      <div className="space-y-2">
        {stats.yearRows.map(({ year, fees, revenue, feeRate }) => (
          <div key={year} className="flex items-center justify-between text-xs border-t border-slate-700/50 pt-2">
            <span className="text-slate-300 w-12">{year}</span>
            <span className="text-slate-400">{formatCurrency(fees, true)}</span>
            <span className="text-slate-500">({formatPct(feeRate)} of rev)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManagementPage() {
  const { data, loading, error } = useMonthlyData();

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl animate-pulse">
        <div className="h-8 bg-slate-700 rounded w-56" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-72 bg-slate-800 rounded-lg border border-slate-700" />
          ))}
        </div>
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
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Management Scorecard</h1>
        <p className="text-sm text-slate-400 mt-1">McKibbon Hospitality — performance analysis</p>
      </div>

      {/* Top row: Expense Ratios + Flow-Through */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExpenseRatios data={data} />
        <GOPFlowThrough data={data} />
      </div>

      {/* Bottom row: Expense Adherence + Fee Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExpenseBudgetAdherence data={data} />
        <ManagementFeeSummary data={data} />
      </div>
    </div>
  );
}
