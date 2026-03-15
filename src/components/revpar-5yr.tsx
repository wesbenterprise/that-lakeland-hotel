"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";

interface RevParHistoryData {
  years: number[];
  data: Array<Record<string, number | string>>;
}

const YEAR_COLORS: Record<number, { stroke: string; strokeWidth: number }> = {
  2022: { stroke: "#94a3b8", strokeWidth: 1.5 },
  2023: { stroke: "#cbd5e1", strokeWidth: 1.5 },
  2024: { stroke: "#38bdf8", strokeWidth: 1.5 },
  2025: { stroke: "#34d399", strokeWidth: 1.5 },
  2026: { stroke: "#6ee7b7", strokeWidth: 2.5 },
};

function getYearStyle(year: number, currentYear: number) {
  const preset = YEAR_COLORS[year];
  if (preset) return preset;
  // fallback for dynamic years
  return year === currentYear
    ? { stroke: "#6ee7b7", strokeWidth: 2.5 }
    : { stroke: "#94a3b8", strokeWidth: 1.5 };
}

interface Props {
  /** Number of years to show. Default 5 (all). Pass 3 for sparkline mode. */
  yearCount?: number;
  /** Chart height class applied to the inner div. Default "h-72 lg:h-80". */
  heightClass?: string;
}

export function RevPar5Yr({ yearCount = 5, heightClass = "h-72 lg:h-80" }: Props) {
  const [histData, setHistData] = useState<RevParHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/revpar-history")
      .then((r) => r.json())
      .then((json: RevParHistoryData) => {
        setHistData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message ?? "Failed to load");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className={`${heightClass} flex items-center justify-center text-slate-400 animate-pulse`}>
        Loading…
      </div>
    );
  }

  if (error || !histData) {
    return (
      <div className={`${heightClass} flex items-center justify-center text-slate-500 text-sm`}>
        {error ?? "No data"}
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  // Slice to the most recent `yearCount` years
  const years = histData.years.slice(-yearCount);
  const chartData = histData.data;

  return (
    <div className={`w-full ${heightClass}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="label"
            stroke="#94a3b8"
            fontSize={11}
            tick={{ fill: "#94a3b8" }}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={11}
            tick={{ fill: "#94a3b8" }}
            tickFormatter={(v) => `$${v}`}
            width={52}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "8px",
              color: "#e2e8f0",
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [
              value != null ? `$${value.toFixed(2)}` : "—",
              name,
            ]}
          />
          <Legend
            wrapperStyle={{ color: "#94a3b8", fontSize: 12 }}
          />
          {years.map((year) => {
            const style = getYearStyle(year, currentYear);
            return (
              <Line
                key={year}
                type="monotone"
                dataKey={String(year)}
                name={String(year)}
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
                dot={year === currentYear ? { r: 4, fill: style.stroke } : { r: 2, fill: style.stroke }}
                connectNulls
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
