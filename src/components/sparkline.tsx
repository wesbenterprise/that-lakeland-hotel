"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";

export function MiniSparkline({ data }: { data: number[] }) {
  const chartData = data.map((v, i) => ({ v, i }));
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="v"
          stroke="#10b981"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
