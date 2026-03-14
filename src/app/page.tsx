"use client";

import { useState, useMemo } from "react";
import { useMonthlyData } from "@/lib/hooks";
import { KPICard } from "@/components/kpi-card";
import { RevenueChart } from "@/components/revenue-chart";
import { RevPARTrend } from "@/components/revpar-trend";
import { SummaryTable } from "@/components/summary-table";
import { PeriodSelector } from "@/components/period-selector";
import { formatCurrency, formatPct, fullMonthName } from "@/lib/utils";

export default function OverviewPage() {
  const { data, loading } = useMonthlyData();
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400">Loading dashboard...</div>
      </div>
    );
  }

  if (!currentPeriod) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <p className="text-lg mb-2">No data yet</p>
        <p className="text-sm">Upload an income statement to get started.</p>
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-4">Revenue Composition</h3>
          <RevenueChart period={currentPeriod} />
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-4">RevPAR Trailing 12 Months</h3>
          <RevPARTrend data={trailing12} />
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Income Statement Summary</h3>
        <SummaryTable period={currentPeriod} />
      </div>
    </div>
  );
}
