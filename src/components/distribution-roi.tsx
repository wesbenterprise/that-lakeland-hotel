"use client";

import { Distribution } from "@/lib/types";
import { INVESTORS, TOTAL_INVESTED_CAPITAL, TOTAL_DEBT_REDUCTION } from "@/lib/distribution-constants";
import { formatCurrency } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";

const INVESTOR_COLORS: Record<string, string> = {
  barnett: "#10b981",
  costa: "#0ea5e9",
  lee: "#f59e0b",
  loute: "#a78bfa",
};

interface DistributionROIProps {
  distributions: Distribution[];
  loading: boolean;
}

function getInvestorTotal(distributions: Distribution[], key: string): number {
  return distributions.reduce((sum, d) => sum + (d[`${key}_amount` as keyof Distribution] as number), 0);
}

export function DistributionROI({ distributions, loading }: DistributionROIProps) {
  if (loading) {
    return <div className="text-slate-400 text-center py-12">Loading...</div>;
  }

  const investorData = INVESTORS.map((inv) => {
    const totalDistributed = getInvestorTotal(distributions, inv.key);
    const totalReturn = totalDistributed + inv.debt_reduction;
    const returnPct = inv.invested_capital > 0 ? totalReturn / inv.invested_capital : 0;
    const cashOnCashPct = inv.invested_capital > 0 ? totalDistributed / inv.invested_capital : 0;

    return {
      ...inv,
      totalDistributed,
      totalReturn,
      returnPct,
      cashOnCashPct,
    };
  });

  const totalDistributedAll = distributions.reduce((sum, d) => sum + d.total_amount, 0);
  const totalReturnAll = totalDistributedAll + TOTAL_DEBT_REDUCTION;
  const totalReturnPct = TOTAL_INVESTED_CAPITAL > 0 ? totalReturnAll / TOTAL_INVESTED_CAPITAL : 0;
  const totalCashOnCashPct = TOTAL_INVESTED_CAPITAL > 0 ? totalDistributedAll / TOTAL_INVESTED_CAPITAL : 0;

  // Cumulative chart data
  const cumulativeData = distributions.map((d, idx) => {
    const cumulative = distributions.slice(0, idx + 1);
    return {
      label: format(new Date(d.distribution_date + "T00:00:00"), "MMM yyyy"),
      barnett: cumulative.reduce((s, x) => s + x.barnett_amount, 0) / 100,
      costa: cumulative.reduce((s, x) => s + x.costa_amount, 0) / 100,
      lee: cumulative.reduce((s, x) => s + x.lee_amount, 0) / 100,
      loute: cumulative.reduce((s, x) => s + x.loute_amount, 0) / 100,
    };
  });

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-slate-100">Return on Investment</h3>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {investorData.map((inv) => {
          const fillWidth = Math.min(100, inv.cashOnCashPct * 100);
          return (
            <div key={inv.key} className="bg-slate-800 rounded-lg border border-slate-700 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-300">{inv.name}</span>
                <span className="text-xs bg-slate-700 rounded px-1.5 py-0.5 text-slate-400">
                  {(inv.current_pct * 100).toFixed(0)}%
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-100">{formatCurrency(inv.totalDistributed, true)}</div>
              <div className="text-lg font-semibold text-emerald-400">
                {(inv.cashOnCashPct * 100).toFixed(1)}% return
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${fillWidth}%`,
                    backgroundColor: INVESTOR_COLORS[inv.key],
                  }}
                />
              </div>
              <div className="text-xs text-slate-500 mt-1">of {formatCurrency(inv.invested_capital, true)} invested</div>
            </div>
          );
        })}
      </div>

      {/* Detailed Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-slate-700">
              <th className="text-left pb-3 pr-4">Metric</th>
              <th className="text-right pb-3 pr-4 font-semibold">Total</th>
              {investorData.map((inv) => (
                <th key={inv.key} className="text-right pb-3 pr-4">{inv.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-sm">
            <tr className="border-b border-slate-700/50">
              <td className="py-3 pr-4 text-slate-300">Invested Capital</td>
              <td className="py-3 pr-4 text-right font-mono font-semibold text-slate-200">{formatCurrency(TOTAL_INVESTED_CAPITAL)}</td>
              {investorData.map((inv) => (
                <td key={inv.key} className="py-3 pr-4 text-right font-mono text-slate-200">{formatCurrency(inv.invested_capital)}</td>
              ))}
            </tr>
            <tr className="border-b border-slate-700/50">
              <td className="py-3 pr-4 text-slate-300">Total Distributions</td>
              <td className="py-3 pr-4 text-right font-mono font-semibold text-slate-200">{formatCurrency(totalDistributedAll)}</td>
              {investorData.map((inv) => (
                <td key={inv.key} className="py-3 pr-4 text-right font-mono text-slate-200">{formatCurrency(inv.totalDistributed)}</td>
              ))}
            </tr>
            <tr className="border-b border-slate-700/50">
              <td className="py-3 pr-4 text-slate-300">Debt Reduction</td>
              <td className="py-3 pr-4 text-right font-mono font-semibold text-slate-200">{formatCurrency(TOTAL_DEBT_REDUCTION)}</td>
              {investorData.map((inv) => (
                <td key={inv.key} className="py-3 pr-4 text-right font-mono text-slate-200">{formatCurrency(inv.debt_reduction)}</td>
              ))}
            </tr>
            <tr className="border-b border-slate-700/50">
              <td className="py-3 pr-4 text-emerald-400 font-semibold">Total Return</td>
              <td className="py-3 pr-4 text-right font-mono font-semibold text-emerald-400">{formatCurrency(totalReturnAll)}</td>
              {investorData.map((inv) => (
                <td key={inv.key} className="py-3 pr-4 text-right font-mono text-emerald-400 font-semibold">{formatCurrency(inv.totalReturn)}</td>
              ))}
            </tr>
            <tr className="border-b border-slate-700/50">
              <td className="py-3 pr-4 text-emerald-400 font-semibold">Return %</td>
              <td className="py-3 pr-4 text-right font-semibold text-emerald-400">{(totalReturnPct * 100).toFixed(1)}%</td>
              {investorData.map((inv) => (
                <td key={inv.key} className="py-3 pr-4 text-right text-emerald-400 font-semibold">{(inv.returnPct * 100).toFixed(1)}%</td>
              ))}
            </tr>
            <tr>
              <td className="py-3 pr-4 text-slate-300">Cash-on-Cash %</td>
              <td className="py-3 pr-4 text-right font-semibold text-slate-200">{(totalCashOnCashPct * 100).toFixed(1)}%</td>
              {investorData.map((inv) => (
                <td key={inv.key} className="py-3 pr-4 text-right text-slate-200">{(inv.cashOnCashPct * 100).toFixed(1)}%</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Cumulative Distribution Chart */}
      {cumulativeData.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Cumulative Distributions</h4>
          <div className="h-64 lg:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeData}>
                <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => {
                    if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
                    return `$${(v / 1000).toFixed(0)}k`;
                  }}
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
                <Area type="monotone" dataKey="barnett" stackId="1" stroke={INVESTOR_COLORS.barnett} fill={INVESTOR_COLORS.barnett} fillOpacity={0.3} name="Barnett" />
                <Area type="monotone" dataKey="costa" stackId="1" stroke={INVESTOR_COLORS.costa} fill={INVESTOR_COLORS.costa} fillOpacity={0.3} name="Costa" />
                <Area type="monotone" dataKey="lee" stackId="1" stroke={INVESTOR_COLORS.lee} fill={INVESTOR_COLORS.lee} fillOpacity={0.3} name="Lee" />
                <Area type="monotone" dataKey="loute" stackId="1" stroke={INVESTOR_COLORS.loute} fill={INVESTOR_COLORS.loute} fillOpacity={0.3} name="Loute" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
