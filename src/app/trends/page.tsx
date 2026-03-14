"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  CartesianGrid,
} from "recharts";
import { useMonthlyData } from "@/lib/hooks";
import { MonthlyPeriod } from "@/lib/types";
import { monthName, formatCurrency, formatPct } from "@/lib/utils";

type MetricKey = keyof typeof METRICS;

const METRICS = {
  total_revenue: { label: "Total Revenue", color: "#10b981", type: "dollars" as const, group: "Revenue" },
  room_revenue: { label: "Room Revenue", color: "#0ea5e9", type: "dollars" as const, group: "Revenue" },
  fb_revenue: { label: "F&B Revenue", color: "#f59e0b", type: "dollars" as const, group: "Revenue" },
  gross_operating_profit: { label: "GOP", color: "#10b981", type: "dollars" as const, group: "Profitability" },
  gop_pct: { label: "GOP %", color: "#22d3ee", type: "pct" as const, group: "Profitability" },
  nop_hotel: { label: "NOP Hotel", color: "#a78bfa", type: "dollars" as const, group: "Profitability" },
  nop_pct: { label: "NOP %", color: "#c084fc", type: "pct" as const, group: "Profitability" },
  occupancy_pct: { label: "Occupancy", color: "#f97316", type: "pct" as const, group: "Operating Stats" },
  adr: { label: "ADR", color: "#f43e5e", type: "dollars" as const, group: "Operating Stats" },
  revpar: { label: "RevPAR", color: "#ec4899", type: "dollars" as const, group: "Operating Stats" },
};

const BUDGET_MAP: Partial<Record<MetricKey, keyof MonthlyPeriod>> = {
  total_revenue: "total_revenue_budget",
  room_revenue: "room_revenue_budget",
  gross_operating_profit: "gop_budget",
  gop_pct: "gop_pct_budget",
  nop_hotel: "nop_hotel_budget",
  nop_pct: "nop_pct_budget",
  occupancy_pct: "occupancy_pct_budget",
  adr: "adr_budget",
  revpar: "revpar_budget",
};

const PY_MAP: Partial<Record<MetricKey, keyof MonthlyPeriod>> = {
  total_revenue: "total_revenue_py",
  room_revenue: "room_revenue_py",
  gross_operating_profit: "gop_py",
  gop_pct: "gop_pct_py",
  nop_hotel: "nop_hotel_py",
  nop_pct: "nop_pct_py",
  occupancy_pct: "occupancy_pct_py",
  adr: "adr_py",
  revpar: "revpar_py",
};

type Range = "ttm" | "ytd" | "2yr" | "all";

function TrendsContent() {
  const { data, loading } = useMonthlyData();
  const searchParams = useSearchParams();
  const initialMetric = searchParams.get("metric") as MetricKey | null;

  const [selected, setSelected] = useState<MetricKey[]>(
    initialMetric && initialMetric in METRICS ? [initialMetric] : ["revpar"]
  );
  const [showBudget, setShowBudget] = useState(false);
  const [showPY, setShowPY] = useState(false);
  const [range, setRange] = useState<Range>("ttm");

  const filtered = useMemo(() => {
    if (data.length === 0) return [];
    const now = data.length - 1;
    switch (range) {
      case "ttm": return data.slice(Math.max(0, now - 11));
      case "ytd": {
        const yr = data[now].year;
        return data.filter(d => d.year === yr);
      }
      case "2yr": return data.slice(Math.max(0, now - 23));
      case "all": return data;
    }
  }, [data, range]);

  const chartData = useMemo(() => {
    return filtered.map((d) => {
      const point: Record<string, number | string | null> = {
        name: `${monthName(d.month)} ${d.year}`,
      };
      for (const key of selected) {
        const meta = METRICS[key];
        const raw = d[key as keyof MonthlyPeriod] as number | null;
        point[key] = raw != null
          ? meta.type === "dollars" ? raw / 100 : raw * 100
          : null;

        if (showBudget && BUDGET_MAP[key]) {
          const bRaw = d[BUDGET_MAP[key]!] as number | null;
          point[`${key}_budget`] = bRaw != null
            ? meta.type === "dollars" ? bRaw / 100 : bRaw * 100
            : null;
        }
        if (showPY && PY_MAP[key]) {
          const pyRaw = d[PY_MAP[key]!] as number | null;
          point[`${key}_py`] = pyRaw != null
            ? meta.type === "dollars" ? pyRaw / 100 : pyRaw * 100
            : null;
        }
      }
      return point;
    });
  }, [filtered, selected, showBudget, showPY]);

  const groups = useMemo(() => {
    const g: Record<string, MetricKey[]> = {};
    for (const [key, meta] of Object.entries(METRICS)) {
      (g[meta.group] ??= []).push(key as MetricKey);
    }
    return g;
  }, []);

  const toggle = (key: MetricKey) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400 animate-pulse">Loading...</div>;
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <h1 className="text-2xl font-bold">Trend Charts</h1>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Metric selector */}
        <div className="w-full lg:w-56 space-y-4 shrink-0">
          {Object.entries(groups).map(([group, keys]) => (
            <div key={group}>
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">{group}</h4>
              {keys.map((key) => (
                <label key={key} className="flex items-center gap-2 py-1 text-sm text-slate-300 cursor-pointer hover:text-slate-100">
                  <input
                    type="checkbox"
                    checked={selected.includes(key)}
                    onChange={() => toggle(key)}
                    className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: METRICS[key].color }}
                  />
                  {METRICS[key].label}
                </label>
              ))}
            </div>
          ))}
        </div>

        {/* Chart area */}
        <div className="flex-1 bg-slate-800 rounded-lg border border-slate-700 p-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex gap-1">
              {(["ttm", "ytd", "2yr", "all"] as Range[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 text-xs rounded-md ${
                    range === r ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={showBudget} onChange={(e) => setShowBudget(e.target.checked)} className="rounded border-slate-600 bg-slate-800" />
              Show Budget
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={showPY} onChange={(e) => setShowPY(e.target.checked)} className="rounded border-slate-600 bg-slate-800" />
              Show Prior Year
            </label>
          </div>

          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} angle={-45} textAnchor="end" height={60} />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                tickFormatter={(v) => {
                  const hasPct = selected.some(k => METRICS[k].type === "pct");
                  const hasDollar = selected.some(k => METRICS[k].type === "dollars");
                  if (hasPct && !hasDollar) return `${v}%`;
                  return `$${(v / 1000).toFixed(0)}K`;
                }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#e2e8f0" }}
              />
              <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
              {selected.map((key) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={METRICS[key].color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name={METRICS[key].label}
                  connectNulls
                />
              ))}
              {showBudget && selected.map((key) =>
                BUDGET_MAP[key] ? (
                  <Line
                    key={`${key}_budget`}
                    type="monotone"
                    dataKey={`${key}_budget`}
                    stroke={METRICS[key].color}
                    strokeWidth={1}
                    strokeDasharray="6 3"
                    dot={false}
                    name={`${METRICS[key].label} Budget`}
                    connectNulls
                  />
                ) : null
              )}
              {showPY && selected.map((key) =>
                PY_MAP[key] ? (
                  <Line
                    key={`${key}_py`}
                    type="monotone"
                    dataKey={`${key}_py`}
                    stroke={METRICS[key].color}
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    dot={false}
                    name={`${METRICS[key].label} PY`}
                    connectNulls
                  />
                ) : null
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default function TrendsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400 animate-pulse">Loading...</div>}>
      <TrendsContent />
    </Suspense>
  );
}
