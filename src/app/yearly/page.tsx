"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, LineChart, Line, ComposedChart,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface YearlyMetric {
  label: string;
  format: "currency" | "percent" | "integer";
  indent?: boolean;
  values: Record<string, number>;
}

interface PartialYearProjection {
  priorYear: number;
  priorYtdRevenue: number;
  priorYtdNop: number | null;
  priorFullYearRevenue: number;
  priorFullYearNop: number | null;
  ytdGrowthPct: number;
  projectedRevenue: number;
  projectedNop: number | null;
}

interface YearlyData {
  years: number[];
  metrics: YearlyMetric[];
  partialYears?: Record<string, string>;
  projection?: PartialYearProjection;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatValue(value: number | null | undefined, format: "currency" | "percent" | "integer"): string {
  if (value == null || !isFinite(value)) return "—";
  if (format === "percent") return `${(value * 100).toFixed(1)}%`;
  if (format === "integer") return value.toLocaleString("en-US");
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(3)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function yoyChange(curr: number | undefined, prev: number | undefined, format: string): string {
  if (curr == null || prev == null || prev === 0 || !isFinite(curr) || !isFinite(prev)) return "—";
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  const sign = pct >= 0 ? "+" : "";
  if (format === "percent") {
    const diff = (curr - prev) * 100;
    return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}pts`;
  }
  return `${sign}${pct.toFixed(1)}%`;
}

// ─── Bar + Line Chart ─────────────────────────────────────────────────────────

function YearlyChart({ years, metrics, partialYears }: {
  years: number[];
  metrics: YearlyMetric[];
  partialYears?: Record<string, string>;
}) {
  const revenueMetric = metrics.find((m) => m.label === "Total Revenue");
  const nopMetric = metrics.find((m) => m.label === "NOP");

  const chartData = years.map((yr) => {
    const rev = revenueMetric?.values[String(yr)] ?? 0;
    const nop = nopMetric?.values[String(yr)] ?? 0;
    const nopMargin = rev > 0 ? (nop / rev) * 100 : 0;
    return {
      year: String(yr) + (partialYears?.[yr] ? "*" : ""),
      "Total Revenue": rev,
      NOP: nop,
      "NOP Margin %": parseFloat(nopMargin.toFixed(1)),
    };
  });

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-1">
        Annual Revenue & NOP — Year over Year
      </h3>
      <p className="text-xs text-slate-500 mb-4">Bars = absolute values · Line = NOP margin %</p>
      <div className="w-full h-64 lg:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="year" stroke="#94a3b8" fontSize={12} />
            <YAxis
              yAxisId="dollars"
              stroke="#94a3b8"
              fontSize={11}
              tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              stroke="#94a3b8"
              fontSize={11}
              tickFormatter={(v) => `${v}%`}
              domain={[0, 60]}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.06)" }}
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#e2e8f0",
              }}
              formatter={(value: number, name: string) => {
                if (name === "NOP Margin %") return [`${value.toFixed(1)}%`, name];
                const abs = Math.abs(value);
                if (abs >= 1_000_000) return [`$${(value / 1_000_000).toFixed(3)}M`, name];
                return [`$${(value / 1_000).toFixed(0)}K`, name];
              }}
            />
            <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
            <Bar yAxisId="dollars" dataKey="Total Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="dollars" dataKey="NOP" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="NOP Margin %"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ r: 4, fill: "#f59e0b" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

function YearlyTable({ years, metrics, partialYears }: {
  years: number[];
  metrics: YearlyMetric[];
  partialYears?: Record<string, string>;
}) {
  const currentYear = new Date().getFullYear();

  // Build columns: year, (yoy%), year, (yoy%), ...
  const columns: Array<{ type: "year"; year: number } | { type: "yoy"; prevYear: number; currYear: number }> = [];
  for (let i = 0; i < years.length; i++) {
    columns.push({ type: "year", year: years[i] });
    if (i > 0) {
      // Insert YoY before this year (between prev and curr)
    }
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400 font-semibold w-40">Metric</th>
              {years.map((yr, i) => {
                const isCurrent = yr === currentYear;
                const isPartial = !!partialYears?.[yr];
                return [
                  i > 0 && (
                    <th key={`yoy-${yr}`} className="px-2 py-3 text-center text-slate-500 text-xs w-16">
                      YoY
                    </th>
                  ),
                  <th
                    key={yr}
                    className={`text-right px-4 py-3 font-semibold min-w-[110px] ${
                      isCurrent ? "text-emerald-400 bg-emerald-900/20" : "text-slate-200"
                    }`}
                  >
                    {yr}{isPartial ? "*" : ""}
                  </th>,
                ];
              })}
            </tr>
          </thead>

          <tbody>
            {metrics.filter(m => m.label !== "Months of Data").map((metric, idx) => {
              const isEven = idx % 2 === 0;
              const bg = isEven ? "bg-slate-900" : "bg-slate-800";

              return (
                <tr key={metric.label} className={`${bg} border-b border-slate-700/50 hover:bg-slate-700/30`}>
                  <td className={`px-4 py-2.5 text-slate-300 font-medium ${metric.indent ? "pl-8 text-slate-400" : ""}`}>
                    {metric.label}
                  </td>
                  {years.map((yr, i) => {
                    const isCurrent = yr === currentYear;
                    const raw = metric.values[String(yr)];
                    const prevRaw = i > 0 ? metric.values[String(years[i - 1])] : undefined;
                    const formatted = raw != null && isFinite(raw) ? formatValue(raw, metric.format) : "—";
                    const yoy = i > 0 ? yoyChange(raw, prevRaw, metric.format) : null;

                    return [
                      i > 0 && (
                        <td key={`yoy-${yr}`} className={`px-2 py-2.5 text-center text-xs tabular-nums ${
                          yoy && yoy !== "—" ? (yoy.startsWith("+") ? "text-emerald-400" : "text-red-400") : "text-slate-600"
                        }`}>
                          {yoy ?? "—"}
                        </td>
                      ),
                      <td
                        key={yr}
                        className={`px-4 py-2.5 text-right tabular-nums ${
                          isCurrent ? "text-emerald-300 bg-emerald-900/10" : "text-slate-200"
                        } ${metric.indent ? "text-slate-400" : ""}`}
                      >
                        {formatted}
                      </td>,
                    ];
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footnotes */}
      <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-500 space-y-1">
        {partialYears && Object.entries(partialYears).map(([yr, note]) => (
          <p key={yr}>* {yr}: {note}</p>
        ))}
        <p>⚠ 2020 data reflects COVID-19 impact — low occupancy, negative revenues in some periods.</p>
      </div>
    </div>
  );
}

// ─── Annualization Banner ─────────────────────────────────────────────────────

function AnnualizationBanner({ years, metrics, partialYears, projection }: {
  years: number[];
  metrics: YearlyMetric[];
  partialYears?: Record<string, string>;
  projection?: PartialYearProjection;
}) {
  const currentYear = new Date().getFullYear();
  if (!partialYears?.[currentYear]) return null;

  const note = partialYears[currentYear];
  const monthsMatch = note.match(/(\d+) months/);
  const months = monthsMatch ? parseInt(monthsMatch[1]) : null;
  if (!months || months >= 12) return null;

  const revenueMetric = metrics.find((m) => m.label === "Total Revenue");
  const nopMetric = metrics.find((m) => m.label === "NOP");
  const actualRev = revenueMetric?.values[String(currentYear)];
  const actualNop = nopMetric?.values[String(currentYear)];

  if (!actualRev) return null;

  const growthSign = projection && projection.ytdGrowthPct >= 0 ? "+" : "";
  const growthPct = projection ? `${growthSign}${(projection.ytdGrowthPct * 100).toFixed(1)}%` : null;

  return (
    <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <span className="text-amber-400 text-lg">📊</span>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-amber-300 mb-1">
            {currentYear} Partial Year — {note}
          </h4>
          <div className="text-xs text-slate-300 space-y-1.5">
            <p>
              <span className="text-slate-400">YTD Actual: </span>
              <span className="font-semibold">{formatValue(actualRev, "currency")}</span> revenue
              {actualNop != null && (
                <span>, <span className="font-semibold">{formatValue(actualNop, "currency")}</span> NOP</span>
              )}
            </p>
            {projection ? (
              <>
                <p>
                  <span className="text-slate-400">vs {projection.priorYear} same period: </span>
                  <span className={`font-semibold ${projection.ytdGrowthPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {growthPct}
                  </span>
                  <span className="text-slate-500">
                    {" "}({formatValue(actualRev, "currency")} vs {formatValue(projection.priorYtdRevenue, "currency")})
                  </span>
                </p>
                <p>
                  <span className="text-slate-400">Full-year projection: </span>
                  <span className="font-semibold text-amber-300 border-b border-dashed border-amber-600">
                    {formatValue(projection.projectedRevenue, "currency")}
                  </span> revenue
                  {projection.projectedNop != null && (
                    <span>, <span className="text-amber-300 border-b border-dashed border-amber-600">
                      {formatValue(projection.projectedNop, "currency")}
                    </span> NOP</span>
                  )}
                </p>
                <p className="text-slate-500 italic">
                  {projection.priorYear} full year ({formatValue(projection.priorFullYearRevenue, "currency")}) × {growthPct} YTD trend
                </p>
              </>
            ) : (
              <p className="text-slate-500 italic">Insufficient prior-year data for trend projection.</p>
            )}
          </div>
        </div>
      </div>
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
      <div className="space-y-6 max-w-7xl animate-pulse">
        <div className="h-8 bg-slate-700 rounded w-48" />
        <div className="h-72 bg-slate-800 rounded-lg border border-slate-700" />
        <div className="h-64 bg-slate-800 rounded-lg border border-slate-700" />
      </div>
    );
  }

  if (error || !data) {
    return <div className="text-red-400 p-4">Failed to load yearly data: {error ?? "Unknown error"}</div>;
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Yearly Results</h1>
        <p className="text-sm text-slate-400 mt-1">Annual performance summary — SpringHill Suites Lakeland</p>
      </div>

      {/* Annualization Banner */}
      <AnnualizationBanner years={data.years} metrics={data.metrics} partialYears={data.partialYears} projection={data.projection} />

      {/* Bar + NOP margin chart */}
      <YearlyChart years={data.years} metrics={data.metrics} partialYears={data.partialYears} />

      {/* Table with YoY columns */}
      <YearlyTable years={data.years} metrics={data.metrics} partialYears={data.partialYears} />
    </div>
  );
}
