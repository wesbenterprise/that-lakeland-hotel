"use client";

import { MonthlyPeriod } from "@/lib/types";
import { fullMonthName } from "@/lib/utils";

interface Props {
  periods: MonthlyPeriod[];
  selectedIdx: number;
  onChange: (idx: number) => void;
}

export function PeriodSelector({ periods, selectedIdx, onChange }: Props) {
  return (
    <select
      value={selectedIdx}
      onChange={(e) => onChange(Number(e.target.value))}
      className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
    >
      {periods.map((p, i) => (
        <option key={p.period} value={i}>
          {fullMonthName(p.month)} {p.year}
        </option>
      ))}
    </select>
  );
}
