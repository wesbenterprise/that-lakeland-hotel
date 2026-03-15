"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { MonthlyPeriod } from "@/lib/types";

export function RevenueChart({ period }: { period: MonthlyPeriod }) {
  const data = [
    {
      name: "Room",
      actual: (period.room_revenue ?? 0) / 100,
      budget: (period.room_revenue_budget ?? 0) / 100,
    },
    {
      name: "F&B",
      actual: (period.fb_revenue ?? 0) / 100,
      budget: (period.fb_revenue_budget ?? 0) / 100,
    },
    {
      name: "Other",
      actual: ((period.other_operated_revenue ?? 0) + (period.misc_income ?? 0)) / 100,
    },
  ];

  return (
    <div className="w-full h-64 lg:h-72">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} barGap={4}>
        <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
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
          formatter={(value: number) =>
            new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
          }
        />
        <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
        <Bar dataKey="actual" fill="#10b981" name="Actual" radius={[4, 4, 0, 0]} />
        <Bar dataKey="budget" fill="#334155" name="Budget" radius={[4, 4, 0, 0]} strokeDasharray="4 4" stroke="#64748b" />
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}
