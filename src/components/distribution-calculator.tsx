"use client";

import { useState, useMemo, useCallback } from "react";
import { calculateDistribution } from "@/lib/distribution-calc";
import { DEFAULT_OPERATING_BUFFER } from "@/lib/distribution-constants";

function formatDollarInput(val: number): string {
  if (val === 0) return "0";
  return val.toLocaleString("en-US");
}

function parseDollarInput(str: string): number {
  const cleaned = str.replace(/[^0-9]/g, "");
  return cleaned === "" ? 0 : parseInt(cleaned, 10);
}

function formatDollarDisplay(val: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

interface DollarInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
}

function DollarInput({ label, value, onChange }: DollarInputProps) {
  const [focused, setFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState(formatDollarInput(value));

  const handleFocus = () => {
    setFocused(true);
    setDisplayValue(value === 0 ? "" : value.toString());
  };

  const handleBlur = () => {
    setFocused(false);
    setDisplayValue(formatDollarInput(value));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplayValue(raw);
    onChange(parseDollarInput(raw));
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={focused ? displayValue : formatDollarInput(value)}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="w-full bg-slate-900 border border-slate-600 rounded-md pl-7 pr-3 py-2 text-slate-100 text-right font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        />
      </div>
    </div>
  );
}

export function DistributionCalculator() {
  const [inputs, setInputs] = useState({
    cash_in_bank: 0,
    operating_buffer: DEFAULT_OPERATING_BUFFER,
    reserve_balance: 0,
    restricted_funds: 0,
    future_reserves: 0,
  });

  const updateField = useCallback((field: string, value: number) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  }, []);

  const result = useMemo(() => calculateDistribution(inputs), [inputs]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Inputs Panel */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Inputs</h3>
        <div className="space-y-4">
          <DollarInput
            label="Cash in Bank"
            value={inputs.cash_in_bank}
            onChange={(v) => updateField("cash_in_bank", v)}
          />
          <DollarInput
            label="Operating Buffer"
            value={inputs.operating_buffer}
            onChange={(v) => updateField("operating_buffer", v)}
          />
          <DollarInput
            label="Reserve Balance"
            value={inputs.reserve_balance}
            onChange={(v) => updateField("reserve_balance", v)}
          />
          <DollarInput
            label="Restricted Funds"
            value={inputs.restricted_funds}
            onChange={(v) => updateField("restricted_funds", v)}
          />
          <DollarInput
            label="Future Reserves"
            value={inputs.future_reserves}
            onChange={(v) => updateField("future_reserves", v)}
          />
        </div>
      </div>

      {/* Results Panel */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Results</h3>

        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-slate-300">Minimum Needed</span>
            <span className="text-sm text-slate-300 font-mono">{formatDollarDisplay(result.minimum_needed)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-300">Available to Distribute</span>
            <span className="text-sm text-slate-300 font-mono">{formatDollarDisplay(result.to_distribute_raw)}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-slate-300">Rounded Amount</span>
            <span className="text-2xl font-bold text-emerald-400 font-mono">
              {result.to_distribute_rounded > 0
                ? formatDollarDisplay(result.to_distribute_rounded)
                : "$0"}
            </span>
          </div>
          {result.to_distribute_rounded === 0 && inputs.cash_in_bank > 0 && (
            <p className="text-sm text-amber-400">Insufficient cash for distribution</p>
          )}
          <div className="flex justify-between">
            <span className="text-sm text-slate-300">Remaining in Bank</span>
            <span className="text-sm text-slate-300 font-mono">{formatDollarDisplay(result.remaining_in_bank)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-300">Buffer Above Minimum</span>
            <span className={`text-sm font-mono ${result.buffer >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatDollarDisplay(result.buffer)}
            </span>
          </div>
        </div>

        {/* Per-Investor Table */}
        <div className="border-t border-slate-700 mt-4 pt-4">
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Per Investor</h4>
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-400">
                <th className="text-left pb-2">Investor</th>
                <th className="text-right pb-2 w-20">Ownership</th>
                <th className="text-right pb-2">Distribution</th>
                <th className="text-right pb-2 w-20">Yield</th>
              </tr>
            </thead>
            <tbody>
              {result.per_investor.map((inv) => (
                <tr key={inv.key} className="text-sm border-t border-slate-700/50">
                  <td className="py-2 text-slate-200 font-medium">{inv.name}</td>
                  <td className="py-2 text-right text-slate-400">{(inv.pct * 100).toFixed(0)}%</td>
                  <td className="py-2 text-right text-slate-100 font-mono">{formatDollarDisplay(inv.amount)}</td>
                  <td className="py-2 text-right text-emerald-400">{(inv.yield_pct * 100).toFixed(1)}%</td>
                </tr>
              ))}
              <tr className="text-sm font-semibold border-t border-slate-600">
                <td className="py-2 text-slate-200">Total</td>
                <td className="py-2 text-right text-slate-400">100%</td>
                <td className="py-2 text-right text-slate-100 font-mono">
                  {formatDollarDisplay(result.to_distribute_rounded)}
                </td>
                <td className="py-2 text-right text-emerald-400">
                  {((result.to_distribute_rounded / (700000000 / 100)) * 100).toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
