"use client";

import { useEffect, useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthPoint {
  month: number;
  monthName: string;
  average: number | null;
  lastYear: number | null;
  ttm: number | null;
}

interface HistoricalMetric {
  key: string;
  label: string;
  type: "currency" | "dollar" | "percent";
  monthly: MonthPoint[];
}

interface HistoricalData {
  metrics: HistoricalMetric[];
  averageYears: number[];
  lastYear: number;
  ttmLabel: string;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function toDisplay(raw: number, type: HistoricalMetric["type"]): number {
  if (type === "currency") return raw / 100;        // cents → dollars
  if (type === "dollar")   return raw / 100;        // cents → dollars (small)
  return raw * 100;                                  // decimal → percent
}

function tickFmt(v: number, type: HistoricalMetric["type"]): string {
  if (type === "percent") return `${v.toFixed(1)}%`;
  if (type === "dollar")  return `$${v.toFixed(0)}`;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(3)}M`;
  if (abs >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function tooltipFmt(v: number, type: HistoricalMetric["type"]): string {
  if (type === "percent") return `${v.toFixed(1)}%`;
  if (type === "dollar")  return `$${v.toFixed(2)}`;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(3)}M`;
  if (abs >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

// ─── Metric Selector ──────────────────────────────────────────────────────────

const METRIC_GROUPS = [
  { group: "Revenue",      keys: ["total_revenue", "room_revenue"] },
  { group: "Profitability",keys: ["gross_operating_profit", "nop_hotel", "gop_pct", "nop_pct"] },
  { group: "Op Stats",     keys: ["revpar", "adr", "occupancy_pct"] },
];

// ─── Main Chart ───────────────────────────────────────────────────────────────

function HistoricalChart({
  metric,
  averageYears,
  lastYear,
  ttmLabel,
  showAverage,
  showLastYear,
  showTTM,
}: {
  metric: HistoricalMetric;
  averageYears: number[];
  lastYear: number;
  ttmLabel: string;
  showAverage: boolean;
  showLastYear: boolean;
  showTTM: boolean;
}) {
  const chartData = useMemo(() => {
    return metric.monthly.map((pt) => {
      const out: Record<string, number | string | null> = { name: pt.monthName };
      if (showAverage && pt.average != null) out["Historical Avg"] = toDisplay(pt.average, metric.type);
      if (showLastYear && pt.lastYear != null) out[String(lastYear)] = toDisplay(pt.lastYear, metric.type);
      if (showTTM && pt.ttm != null) out["TTM"] = toDisplay(pt.ttm, metric.type);
      return out;
    });
  }, [metric, showAverage, showLastYear, showTTM, lastYear]);

  const avgYearRange = averageYears.length > 0
    ? `${averageYears[0]}–${averageYears[averageYears.length - 1]}`
    : "Historical";

  return (
    <div className="w-full h-72 lg:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
          <YAxis
            stroke="#94a3b8"
            fontSize={11}
            tickFormatter={(v) => tickFmt(v, metric.type)}
            width={metric.type === "currency" ? 64 : 56}
          />
          <Tooltip
            cursor={{ stroke: "rgba(255,255,255,0.12)", strokeWidth: 1 }}
            contentStyle={{
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "8px",
              color: "#e2e8f0",
            }}
            formatter={(value: number, name: string) => [tooltipFmt(value, metric.type), name]}
          />
          <Legend
            wrapperStyle={{ color: "#94a3b8", fontSize: 12, paddingTop: 8 }}
          />
          {showAverage && (
            <Line
              type="monotone"
              dataKey="Historical Avg"
              stroke="#64748b"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={{ r: 3, fill: "#64748b" }}
              name={`Hist. Avg (${avgYearRange})`}
              connectNulls
            />
          )}
          {showLastYear && (
            <Line
              type="monotone"
              dataKey={String(lastYear)}
              stroke="#10b981"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#10b981" }}
              name={String(lastYear)}
              connectNulls
            />
          )}
          {showTTM && (
            <Line
              type="monotone"
              dataKey="TTM"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#f59e0b" }}
              name={`TTM (${ttmLabel})`}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Summary Stats ────────────────────────────────────────────────────────────

function MonthlySummaryStats({
  metric,
  lastYear,
  ttmLabel,
}: {
  metric: HistoricalMetric;
  lastYear: number;
  ttmLabel: string;
}) {
  const stats = useMemo(() => {
    const avgVals   = metric.monthly.map((p) => p.average).filter((v): v is number => v != null);
    const lyVals    = metric.monthly.map((p) => p.lastYear).filter((v): v is number => v != null);
    const ttmVals   = metric.monthly.map((p) => p.ttm).filter((v): v is number => v != null);

    const peak = (vals: number[]) => vals.length ? Math.max(...vals) : null;
    const trough = (vals: number[]) => vals.length ? Math.min(...vals) : null;
    const monthOf = (vals: number[], fn: (a: number, b: number) => boolean) => {
      if (!vals.length) return null;
      let best = vals[0];
      let bestIdx = 0;
      for (let i = 1; i < vals.length; i++) {
        if (fn(vals[i], best)) { best = vals[i]; bestIdx = i; }
      }
      return metric.monthly[bestIdx]?.monthName ?? null;
    };

    return {
      avg:  { peak: peak(avgVals),  trough: trough(avgVals),  peakMonth: monthOf(avgVals, (a,b) => a > b),  troughMonth: monthOf(avgVals, (a,b) => a < b)  },
      ly:   { peak: peak(lyVals),   trough: trough(lyVals),   peakMonth: monthOf(lyVals, (a,b) => a > b),   troughMonth: monthOf(lyVals, (a,b) => a < b)   },
      ttm:  { peak: peak(ttmVals),  trough: trough(ttmVals),  peakMonth: monthOf(ttmVals, (a,b) => a > b),  troughMonth: monthOf(ttmVals, (a,b) => a < b)  },
    };
  }, [metric]);

  const fmt = (v: number | null) => v != null ? tooltipFmt(toDisplay(v, metric.type), metric.type) : "—";

  const rows = [
    { label: "Hist. Avg",    s: stats.avg },
    { label: String(lastYear), s: stats.ly },
    { label: `TTM`,            s: stats.ttm },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 mt-4">
      {rows.map(({ label, s }) => (
        <div key={label} className="bg-slate-900 rounded-lg border border-slate-700 p-3 text-xs">
          <p className="text-slate-400 font-medium mb-2">{label}</p>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Peak</span>
              <span className="text-emerald-400 font-semibold tabular-nums">{fmt(s.peak)}</span>
            </div>
            {s.peakMonth && <div className="flex justify-between"><span className="text-slate-600">Month</span><span className="text-slate-400">{s.peakMonth}</span></div>}
            <div className="flex justify-between mt-1">
              <span className="text-slate-500">Trough</span>
              <span className="text-red-400 font-semibold tabular-nums">{fmt(s.trough)}</span>
            </div>
            {s.troughMonth && <div className="flex justify-between"><span className="text-slate-600">Month</span><span className="text-slate-400">{s.troughMonth}</span></div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoricalPage() {
  const [data, setData]       = useState<HistoricalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [selectedKey, setSelectedKey] = useState("total_revenue");
  const [showAverage,  setShowAverage]  = useState(true);
  const [showLastYear, setShowLastYear] = useState(true);
  const [showTTM,      setShowTTM]      = useState(true);

  useEffect(() => {
    fetch("/api/historical")
      .then((r) => r.json())
      .then((d: HistoricalData & { error?: string }) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const currentMetric = useMemo(
    () => data?.metrics.find((m) => m.key === selectedKey) ?? null,
    [data, selectedKey]
  );

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl animate-pulse">
        <div className="h-8 bg-slate-700 rounded w-56" />
        <div className="h-96 bg-slate-800 rounded-lg border border-slate-700" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-red-400 p-4">
        Failed to load historical data: {error ?? "Unknown error"}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Historical Patterns</h1>
        <p className="text-sm text-slate-400 mt-1">
          Monthly averages since inception — SpringHill Suites Lakeland
        </p>
      </div>

      {/* Legend explanation */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-6 border-t-2 border-dashed border-slate-500" />
          <span className="text-slate-400">
            Historical Avg ({data.averageYears.length > 0 ? `${data.averageYears[0]}–${data.averageYears[data.averageYears.length - 1]}` : "all years"})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 border-t-2 border-emerald-500" />
          <span className="text-slate-400">{data.lastYear} Actuals</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 border-t-2 border-amber-400" />
          <span className="text-slate-400">TTM ({data.ttmLabel})</span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Metric Selector */}
        <div className="w-full lg:w-48 shrink-0 space-y-4">
          {METRIC_GROUPS.map(({ group, keys }) => (
            <div key={group}>
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">{group}</h4>
              {keys.map((key) => {
                const m = data.metrics.find((x) => x.key === key);
                if (!m) return null;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedKey(key)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm transition-colors mb-0.5",
                      selectedKey === key
                        ? "bg-emerald-600/20 text-emerald-300 border border-emerald-600/40"
                        : "text-slate-300 hover:bg-slate-700/50 hover:text-slate-100"
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Chart area */}
        <div className="flex-1 space-y-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            {/* Chart title + overlay toggles */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h3 className="text-sm font-semibold text-slate-200">
                {currentMetric?.label} — Monthly Pattern
              </h3>
              <div className="flex flex-wrap gap-3 text-xs">
                <label className={cn(
                  "flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-md border transition-colors",
                  showAverage
                    ? "bg-slate-700 border-slate-600 text-slate-200"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                )}>
                  <input type="checkbox" checked={showAverage} onChange={(e) => setShowAverage(e.target.checked)} className="sr-only" />
                  <span className="w-4 border-t border-dashed border-slate-400" />
                  Historical Avg
                </label>
                <label className={cn(
                  "flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-md border transition-colors",
                  showLastYear
                    ? "bg-slate-700 border-slate-600 text-slate-200"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                )}>
                  <input type="checkbox" checked={showLastYear} onChange={(e) => setShowLastYear(e.target.checked)} className="sr-only" />
                  <span className="w-4 border-t-2 border-emerald-500" />
                  {data.lastYear}
                </label>
                <label className={cn(
                  "flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-md border transition-colors",
                  showTTM
                    ? "bg-slate-700 border-slate-600 text-slate-200"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                )}>
                  <input type="checkbox" checked={showTTM} onChange={(e) => setShowTTM(e.target.checked)} className="sr-only" />
                  <span className="w-4 border-t-2 border-amber-400" />
                  TTM
                </label>
              </div>
            </div>

            {currentMetric && (
              <HistoricalChart
                metric={currentMetric}
                averageYears={data.averageYears}
                lastYear={data.lastYear}
                ttmLabel={data.ttmLabel}
                showAverage={showAverage}
                showLastYear={showLastYear}
                showTTM={showTTM}
              />
            )}
          </div>

          {/* Peak / trough summary */}
          {currentMetric && (
            <MonthlySummaryStats
              metric={currentMetric}
              lastYear={data.lastYear}
              ttmLabel={data.ttmLabel}
            />
          )}
        </div>
      </div>

      {/* All metrics mini-grid */}
      <div>
        <h2 className="text-base font-semibold text-slate-200 mb-4">All Metrics — Monthly Snapshot</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.metrics.map((m) => {
            const chartData = m.monthly.map((pt) => ({
              name: pt.monthName,
              avg: pt.average != null ? toDisplay(pt.average, m.type) : null,
              ly:  pt.lastYear != null ? toDisplay(pt.lastYear, m.type)  : null,
              ttm: pt.ttm      != null ? toDisplay(pt.ttm, m.type)       : null,
            }));

            return (
              <button
                key={m.key}
                onClick={() => { setSelectedKey(m.key); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="bg-slate-800 rounded-lg border border-slate-700 p-4 hover:border-slate-600 transition-colors text-left"
              >
                <p className="text-xs font-semibold text-slate-300 mb-3">{m.label}</p>
                <div className="h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 2, right: 4, left: 0, bottom: 2 }}>
                      <YAxis hide domain={["auto", "auto"]} />
                      <Line type="monotone" dataKey="avg" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 2" dot={false} connectNulls />
                      <Line type="monotone" dataKey="ly"  stroke="#10b981" strokeWidth={2}   dot={false} connectNulls />
                      <Line type="monotone" dataKey="ttm" stroke="#f59e0b" strokeWidth={2}   dot={false} connectNulls />
                      <Tooltip
                        cursor={{ stroke: "rgba(255,255,255,0.1)" }}
                        contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#e2e8f0", fontSize: 11 }}
                        formatter={(v: number, name: string) => [
                          tooltipFmt(v, m.type),
                          name === "avg" ? "Hist. Avg" : name === "ly" ? String(data.lastYear) : "TTM",
                        ]}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
