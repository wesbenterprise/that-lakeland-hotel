"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface YearlyMetric {
  label: string;
  format: "currency" | "percent" | "integer";
  indent?: boolean;
  values: Record<string, number>;
}

interface YearlyData {
  years: number[];
  metrics: YearlyMetric[];
  partialYears?: Record<string, string>;
  demo?: boolean;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatValue(value: number, format: "currency" | "percent" | "integer"): string {
  if (format === "percent") {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (format === "integer") {
    return value.toLocaleString("en-US");
  }
  // currency
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatMillions(value: number): string {
  return `$${(value / 1_000_000).toFixed(2)}M`;
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

function YearlyBarChart({
  years,
  metrics,
  partialYears,
}: {
  years: number[];
  metrics: YearlyMetric[];
  partialYears?: Record<string, string>;
}) {
  const revenueMetric = metrics.find((m) => m.label === "Total Revenue");
  const nopMetric = metrics.find((m) => m.label === "NOP");

  const chartData = years.map((yr) => ({
    year: String(yr) + (partialYears?.[yr] ? "*" : ""),
    "Total Revenue": (revenueMetric?.values[String(yr)] ?? 0),
    "NOP": (nopMetric?.values[String(yr)] ?? 0),
  }));

  const tooltipFormatter = (value: number) => formatMillions(value);

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-4">
        Total Revenue vs NOP — Year over Year
      </h3>
      <div className="w-full h-56 lg:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="year" stroke="#94a3b8" fontSize={12} />
            <YAxis
              stroke="#94a3b8"
              fontSize={11}
              tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#e2e8f0",
              }}
              formatter={tooltipFormatter}
            />
            <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
            <Bar dataKey="Total Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="NOP" fill="#a78bfa" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

function YearlyTable({
  years,
  metrics,
  partialYears,
}: {
  years: number[];
  metrics: YearlyMetric[];
  partialYears?: Record<string, string>;
}) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* Header */}
          <thead>
            <tr className="bg-slate-900 border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400 font-semibold w-40">
                Metric
              </th>
              {years.map((yr) => {
                const isCurrent = yr === currentYear;
                const isPartial = !!partialYears?.[yr];
                return (
                  <th
                    key={yr}
                    className={`text-right px-4 py-3 font-semibold min-w-[100px] ${
                      isCurrent
                        ? "text-emerald-400 bg-emerald-900/20"
                        : "text-slate-200"
                    }`}
                  >
                    {yr}
                    {isPartial ? "*" : ""}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {metrics.map((metric, idx) => {
              const isEven = idx % 2 === 0;
              const bg = isEven ? "bg-slate-900" : "bg-slate-800";

              return (
                <tr
                  key={metric.label}
                  className={`${bg} border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors`}
                >
                  <td
                    className={`px-4 py-2.5 text-slate-300 font-medium ${
                      metric.indent ? "pl-8 text-slate-400" : ""
                    }`}
                  >
                    {metric.label}
                  </td>
                  {years.map((yr) => {
                    const isCurrent = yr === currentYear;
                    const raw = metric.values[String(yr)];
                    const formatted =
                      raw != null ? formatValue(raw, metric.format) : "—";
                    return (
                      <td
                        key={yr}
                        className={`px-4 py-2.5 text-right tabular-nums ${
                          isCurrent
                            ? "text-emerald-300 bg-emerald-900/10"
                            : "text-slate-200"
                        } ${metric.indent ? "text-slate-400" : ""}`}
                      >
                        {formatted}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footnotes */}
      {partialYears && Object.keys(partialYears).length > 0 && (
        <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-500 space-y-1">
          {Object.entries(partialYears).map(([yr, note]) => (
            <p key={yr}>* {yr}: {note}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function YearlyPage() {
  const [data, setData] = useState<YearlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/yearly")
      .then((r) => r.json())
      .then((d: YearlyData & { error?: string }) => {
        if (d.error) {
          setError(d.error);
        } else {
          setData(d);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 animate-pulse">
        Loading…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-red-400 p-4">
        Failed to load yearly data: {error ?? "Unknown error"}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Yearly Results</h1>
          <p className="text-sm text-slate-400 mt-1">
            Annual performance summary — SpringHill Suites Lakeland
          </p>
        </div>
        {data.demo && (
          <span className="px-3 py-1 bg-amber-900/30 text-amber-400 border border-amber-700/50 rounded-full text-xs font-medium">
            Demo Data
          </span>
        )}
      </div>

      {/* Bar Chart */}
      <YearlyBarChart
        years={data.years}
        metrics={data.metrics}
        partialYears={data.partialYears}
      />

      {/* Comparison Table */}
      <YearlyTable
        years={data.years}
        metrics={data.metrics}
        partialYears={data.partialYears}
      />
    </div>
  );
}
