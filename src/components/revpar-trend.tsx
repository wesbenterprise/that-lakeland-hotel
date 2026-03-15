"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { MonthlyPeriod } from "@/lib/types";
import { monthName } from "@/lib/utils";

export function RevPARTrend({ data }: { data: MonthlyPeriod[] }) {
  const chartData = data.map((d) => ({
    name: `${monthName(d.month)} ${d.year}`,
    actual: (d.revpar ?? 0) / 100,
    budget: (d.revpar_budget ?? 0) / 100,
  }));

  return (
    <div className="w-full h-64 lg:h-72">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} angle={-45} textAnchor="end" height={50} />
        <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "8px",
            color: "#e2e8f0",
          }}
          formatter={(value: number) => [`$${value.toFixed(2)}`, ""]}
        />
        <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
        <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="RevPAR" />
        <Line type="monotone" dataKey="budget" stroke="#64748b" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Budget" />
      </LineChart>
    </ResponsiveContainer>
    </div>
  );
}
