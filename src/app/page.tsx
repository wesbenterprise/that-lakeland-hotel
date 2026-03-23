"use client";

import { useState, useMemo } from "react";
import { useMonthlyData } from "@/lib/hooks";
import { KPICard } from "@/components/kpi-card";
import { RevenueChart } from "@/components/revenue-chart";
import { RevPar5Yr } from "@/components/revpar-5yr";
import { SummaryTable } from "@/components/summary-table";
import { PeriodSelector } from "@/components/period-selector";
import { MonthlyPeriod } from "@/lib/types";
import { formatCurrency, formatPct, fullMonthName, cn } from "@/lib/utils";

// ─── YTD Strip ────────────────────────────────────────────────────────────────

function YTDStrip({ data, selectedYear }: { data: MonthlyPeriod[]; selectedYear: number }) {
  const ytd = useMemo(() => {
    const periods = data.filter((d) => d.year === selectedYear);
    if (periods.length === 0) return null;
    // Prefer stored YTD from latest period in year
    const latest = periods[periods.length - 1];

    // Compute YTD by summing
    const sumRevenue = periods.reduce((s, p) => s + (p.total_revenue ?? 0), 0);
    const sumGop = periods.reduce((s, p) => s + (p.gross_operating_profit ?? 0), 0);
    const sumNop = periods.reduce((s, p) => s + (p.nop_hotel ?? 0), 0);

    // Budget from stored YTD fields (latest period has running YTD budget)
    const budgetRevenue = latest.total_revenue_ytd_budget;
    const budgetGop = latest.gop_ytd_budget;
    const budgetNop = latest.nop_hotel_ytd_budget;

    return {
      revenue: { actual: sumRevenue, budget: budgetRevenue },
      gop: { actual: sumGop, budget: budgetGop },
      nop: { actual: sumNop, budget: budgetNop },
    };
  }, [data, selectedYear]);

  if (!ytd) return null;

  const metrics = [
    { label: "YTD Revenue", ...ytd.revenue },
    { label: "YTD GOP", ...ytd.gop },
    { label: "YTD NOP", ...ytd.nop },
  ];

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">
        {selectedYear} YTD Performance
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {metrics.map(({ label, actual, budget }) => {
          const varPct = budget && budget !== 0 ? (actual - budget) / Math.abs(budget) : null;
          const favorable = varPct !== null && varPct >= 0;
          return (
            <div key={label} className="space-y-1">
              <p className="text-xs text-slate-400">{label}</p>
              <p className="text-lg font-bold text-slate-100">{formatCurrency(actual, true)}</p>
              <div className="flex items-center gap-2 text-xs">
                {budget !== null && budget !== undefined && (
                  <span className="text-slate-500">Budget: {formatCurrency(budget, true)}</span>
                )}
                {varPct !== null && (
                  <span className={cn(
                    "font-semibold",
                    favorable ? "text-emerald-400" : "text-red-400"
                  )}>
                    {favorable ? "+" : ""}{(varPct * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Executive Summary ────────────────────────────────────────────────────────

function ExecutiveSummary({ period }: { period: MonthlyPeriod }) {
  const summary = useMemo(() => {
    const p = period;
    const monthName = fullMonthName(p.month);

    const lines: string[] = [];

    // Revenue vs budget and PY
    if (p.total_revenue && p.total_revenue_budget && p.total_revenue_py) {
      const vsBudget = (p.total_revenue - p.total_revenue_budget) / Math.abs(p.total_revenue_budget);
      const vsPY = (p.total_revenue - p.total_revenue_py) / Math.abs(p.total_revenue_py);
      const revStr = formatCurrency(p.total_revenue, true);
      const budgetDir = vsBudget >= 0 ? "beat" : "missed";
      const pyDir = vsPY >= 0 ? "above" : "below";
      lines.push(
        `${monthName} ${p.year}: Revenue of ${revStr} ${budgetDir} budget by ${Math.abs(vsBudget * 100).toFixed(1)}% and is ${Math.abs(vsPY * 100).toFixed(1)}% ${pyDir} prior year.`
      );
    } else if (p.total_revenue) {
      lines.push(`${monthName} ${p.year}: Total revenue of ${formatCurrency(p.total_revenue, true)}.`);
    }

    // GOP performance
    if (p.gop_pct !== null && p.gop_pct_budget !== null) {
      const gopPct = (p.gop_pct ?? 0) * 100;
      const gopBudPct = (p.gop_pct_budget ?? 0) * 100;
      const gopDiff = gopPct - gopBudPct;
      const trend = gopDiff >= 0 ? "above" : "below";
      const tightness = gopDiff >= 0 ? "McKibbon is running tight." : "Expense pressure reducing margins.";
      lines.push(
        `GOP margin of ${gopPct.toFixed(1)}% is ${Math.abs(gopDiff).toFixed(1)}pts ${trend} budget — ${tightness}`
      );
    } else if (p.gop_pct !== null) {
      lines.push(`GOP margin: ${formatPct(p.gop_pct)}.`);
    }

    // NOP
    if (p.nop_hotel && p.nop_hotel_budget) {
      const vsB = (p.nop_hotel - p.nop_hotel_budget) / Math.abs(p.nop_hotel_budget);
      const dir = vsB >= 0 ? "above" : "below";
      lines.push(
        `NOP of ${formatCurrency(p.nop_hotel, true)} is ${Math.abs(vsB * 100).toFixed(1)}% ${dir} budget.`
      );
    }

    return lines.join(" ");
  }, [period]);

  if (!summary) return null;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2">Executive Summary</h3>
      <p className="text-sm text-slate-200 leading-relaxed italic">"{summary}"</p>
    </div>
  );
}

// ─── Financing Card ───────────────────────────────────────────────────────────

function FinancingCard() {
  const ORIG_LOAN = 16_500_000;
  const CURR_BALANCE = 13_400_000;
  const PAID_DOWN = 3_100_000;
  const paidPct = PAID_DOWN / ORIG_LOAN;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 1, notation: "compact" }).format(n);

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3 tracking-wide">Financing</h3>
      <div className="grid grid-cols-3 gap-4 mb-3">
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Original Loan</p>
          <p className="text-lg font-bold text-slate-100">{fmt(ORIG_LOAN)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Current Balance</p>
          <p className="text-lg font-bold text-amber-400">{fmt(CURR_BALANCE)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Principal Paid Down</p>
          <p className="text-lg font-bold text-emerald-400">{fmt(PAID_DOWN)}</p>
        </div>
      </div>
      {/* Paydown progress bar */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Paydown progress</span>
          <span>{(paidPct * 100).toFixed(1)}% of original</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full"
            style={{ width: `${paidPct * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const { data, loading, error } = useMonthlyData();
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const currentPeriod = useMemo(() => {
    if (data.length === 0) return null;
    const idx = selectedIdx ?? data.length - 1;
    return data[idx];
  }, [data, selectedIdx]);

  const trailing12 = useMemo(() => {
    if (data.length === 0) return [];
    const idx = selectedIdx ?? data.length - 1;
    const start = Math.max(0, idx - 11);
    return data.slice(start, idx + 1);
  }, [data, selectedIdx]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl animate-pulse">
        <div className="h-8 bg-slate-700 rounded w-64" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-slate-800 rounded-lg border border-slate-700" />
          ))}
        </div>
        <div className="h-40 bg-slate-800 rounded-lg border border-slate-700" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-800 rounded-lg border border-slate-700" />
          <div className="h-64 bg-slate-800 rounded-lg border border-slate-700" />
        </div>
      </div>
    );
  }

  if (error || !currentPeriod) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <p className="text-lg mb-2">{error ? "Error loading data" : "No data yet"}</p>
        <p className="text-sm">{error ?? "Upload an income statement to get started."}</p>
      </div>
    );
  }

  const p = currentPeriod;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Performance Overview</h1>
          <p className="text-slate-400 text-sm mt-1">
            {fullMonthName(p.month)} {p.year}
          </p>
        </div>
        <PeriodSelector
          periods={data}
          selectedIdx={selectedIdx ?? data.length - 1}
          onChange={setSelectedIdx}
        />
      </div>

      {/* Executive Summary */}
      <ExecutiveSummary period={p} />

      {/* YTD Performance Strip */}
      <YTDStrip data={data} selectedYear={p.year} />

      {/* Financing Card */}
      <FinancingCard />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          title="Occupancy"
          value={formatPct(p.occupancy_pct)}
          budget={p.occupancy_pct_budget}
          actual={p.occupancy_pct}
          priorYear={p.occupancy_pct_py}
          formatFn={formatPct}
          sparkData={trailing12.map(d => (d.occupancy_pct ?? 0) * 100)}
          href="/trends?metric=occupancy"
        />
        <KPICard
          title="ADR"
          value={formatCurrency(p.adr)}
          budget={p.adr_budget}
          actual={p.adr}
          priorYear={p.adr_py}
          formatFn={(v) => formatCurrency(v)}
          sparkData={trailing12.map(d => (d.adr ?? 0) / 100)}
          href="/trends?metric=adr"
        />
        <KPICard
          title="RevPAR"
          value={formatCurrency(p.revpar)}
          budget={p.revpar_budget}
          actual={p.revpar}
          priorYear={p.revpar_py}
          formatFn={(v) => formatCurrency(v)}
          sparkData={trailing12.map(d => (d.revpar ?? 0) / 100)}
          href="/trends?metric=revpar"
        />
        <KPICard
          title="Total Revenue"
          value={formatCurrency(p.total_revenue, true)}
          budget={p.total_revenue_budget}
          actual={p.total_revenue}
          priorYear={p.total_revenue_py}
          formatFn={(v) => formatCurrency(v, true)}
          sparkData={trailing12.map(d => (d.total_revenue ?? 0) / 100)}
          href="/trends?metric=total_revenue"
        />
        <KPICard
          title="GOP"
          value={`${formatCurrency(p.gross_operating_profit, true)}`}
          subtitle={formatPct(p.gop_pct)}
          budget={p.gop_budget}
          actual={p.gross_operating_profit}
          priorYear={p.gop_py}
          formatFn={(v) => formatCurrency(v, true)}
          sparkData={trailing12.map(d => (d.gross_operating_profit ?? 0) / 100)}
          href="/trends?metric=gop"
        />
        <KPICard
          title="NOP Hotel"
          value={`${formatCurrency(p.nop_hotel, true)}`}
          subtitle={formatPct(p.nop_pct)}
          budget={p.nop_hotel_budget}
          actual={p.nop_hotel}
          priorYear={p.nop_hotel_py}
          formatFn={(v) => formatCurrency(v, true)}
          sparkData={trailing12.map(d => (d.nop_hotel ?? 0) / 100)}
          href="/trends?metric=nop"
        />
      </div>

      {/* RevPAR 3-Year Trend */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">RevPAR — 3-Year Trend</h3>
        <RevPar5Yr yearCount={3} heightClass="h-52 lg:h-60" />
      </div>

      {/* Revenue Chart */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Revenue Composition</h3>
        <RevenueChart period={currentPeriod} />
      </div>

      {/* Income Statement Summary */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-4">
          Income Statement Summary — {fullMonthName(p.month)} {p.year}
        </h3>
        <SummaryTable period={currentPeriod} />
      </div>
    </div>
  );
}
