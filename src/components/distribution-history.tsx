"use client";

import { Distribution } from "@/lib/types";
import { formatCurrency, relativeTime } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";

const INVESTOR_COLORS = {
  barnett: "#10b981",
  costa: "#0ea5e9",
  lee: "#f59e0b",
  loute: "#a78bfa",
};

interface DistributionHistoryProps {
  distributions: Distribution[];
  loading: boolean;
}

function formatDistributionDate(dateStr: string): string {
  return format(new Date(dateStr + "T00:00:00"), "MMM yyyy");
}

export function DistributionHistory({ distributions, loading }: DistributionHistoryProps) {
  if (loading) {
    return <div className="text-slate-400 text-center py-12">Loading distributions...</div>;
  }

  if (distributions.length === 0) {
    return <div className="text-slate-400 text-center py-12">No distributions recorded yet.</div>;
  }

  const totalDistributed = distributions.reduce((sum, d) => sum + d.total_amount, 0);

  const chartData = distributions.map((d) => ({
    label: formatDistributionDate(d.distribution_date),
    barnett: d.barnett_amount / 100,
    costa: d.costa_amount / 100,
    lee: d.lee_amount / 100,
    loute: d.loute_amount / 100,
  }));

  const totals = {
    total: totalDistributed,
    barnett: distributions.reduce((sum, d) => sum + d.barnett_amount, 0),
    costa: distributions.reduce((sum, d) => sum + d.costa_amount, 0),
    lee: distributions.reduce((sum, d) => sum + d.lee_amount, 0),
    loute: distributions.reduce((sum, d) => sum + d.loute_amount, 0),
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-100">Distribution History</h3>
        <p className="text-sm text-slate-400">
          {distributions.length} distributions &middot; {formatCurrency(totalDistributed)} total distributed
        </p>
      </div>

      {/* Bar Chart */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="h-64 lg:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.06)" }}
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                }}
                formatter={(value: number, name: string) => [
                  `$${value.toLocaleString()}`,
                  name.charAt(0).toUpperCase() + name.slice(1),
                ]}
              />
              <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
              <Bar dataKey="barnett" stackId="a" fill={INVESTOR_COLORS.barnett} name="Barnett" />
              <Bar dataKey="costa" stackId="a" fill={INVESTOR_COLORS.costa} name="Costa" />
              <Bar dataKey="lee" stackId="a" fill={INVESTOR_COLORS.lee} name="Lee" />
              <Bar dataKey="loute" stackId="a" fill={INVESTOR_COLORS.loute} name="Loute" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-slate-700">
              <th className="text-left pb-3 pr-4">Date</th>
              <th className="text-right pb-3 pr-4">Total</th>
              <th className="text-right pb-3 pr-4">Barnett</th>
              <th className="text-right pb-3 pr-4">Costa</th>
              <th className="text-right pb-3 pr-4">Lee</th>
              <th className="text-right pb-3">Loute</th>
            </tr>
          </thead>
          <tbody>
            {distributions.map((d) => (
              <tr
                key={d.distribution_date}
                className="text-sm text-slate-200 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
              >
                <td className="py-3 pr-4" title={relativeTime(new Date(d.distribution_date + "T00:00:00"))}>
                  {formatDistributionDate(d.distribution_date)}
                </td>
                <td className="py-3 pr-4 text-right font-mono">{formatCurrency(d.total_amount)}</td>
                <td className="py-3 pr-4 text-right">
                  <div className="font-mono">{formatCurrency(d.barnett_amount)}</div>
                  <div className="text-xs text-slate-500">({(d.barnett_pct * 100).toFixed(0)}%)</div>
                </td>
                <td className="py-3 pr-4 text-right">
                  <div className="font-mono">{formatCurrency(d.costa_amount)}</div>
                  <div className="text-xs text-slate-500">({(d.costa_pct * 100).toFixed(0)}%)</div>
                </td>
                <td className="py-3 pr-4 text-right">
                  <div className="font-mono">{formatCurrency(d.lee_amount)}</div>
                  <div className="text-xs text-slate-500">({(d.lee_pct * 100).toFixed(0)}%)</div>
                </td>
                <td className="py-3 text-right">
                  <div className="font-mono">{formatCurrency(d.loute_amount)}</div>
                  <div className="text-xs text-slate-500">({(d.loute_pct * 100).toFixed(0)}%)</div>
                </td>
              </tr>
            ))}
            {/* Total row */}
            <tr className="text-sm font-semibold text-slate-100 border-t-2 border-slate-600">
              <td className="py-3 pr-4">Total</td>
              <td className="py-3 pr-4 text-right font-mono">{formatCurrency(totals.total)}</td>
              <td className="py-3 pr-4 text-right font-mono">{formatCurrency(totals.barnett)}</td>
              <td className="py-3 pr-4 text-right font-mono">{formatCurrency(totals.costa)}</td>
              <td className="py-3 pr-4 text-right font-mono">{formatCurrency(totals.lee)}</td>
              <td className="py-3 text-right font-mono">{formatCurrency(totals.loute)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
