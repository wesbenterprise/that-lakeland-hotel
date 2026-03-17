"use client";

import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { MiniSparkline } from "./sparkline";

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  budget: number | null | undefined;
  actual: number | null | undefined;
  priorYear: number | null | undefined;
  formatFn: (val: number | null | undefined) => string;
  sparkData: number[];
  href: string;
}

function Delta({ label, actual, target }: { label: string; actual: number | null | undefined; target: number | null | undefined }) {
  if (actual == null || target == null || target === 0) return null;
  const delta = actual - target;
  const pct = (delta / Math.abs(target)) * 100;
  const favorable = delta >= 0;

  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-slate-500">{label}:</span>
      {favorable ? (
        <TrendingUp className="h-3 w-3 text-emerald-500" />
      ) : (
        <TrendingDown className="h-3 w-3 text-red-500" />
      )}
      <span className={cn(favorable ? "text-emerald-400" : "text-red-400")}>
        {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
      </span>
    </div>
  );
}

/** Traffic light: green = on/above budget, yellow = within 3%, red = >3% below */
function TrafficLight({ actual, budget }: { actual: number | null | undefined; budget: number | null | undefined }) {
  if (actual == null || budget == null || budget === 0) return null;
  const pct = (actual - budget) / Math.abs(budget);

  let color: string;
  let title: string;
  if (pct >= -0.03) {
    color = pct >= 0 ? "bg-emerald-500" : "bg-yellow-400";
    title = pct >= 0 ? `+${(pct * 100).toFixed(1)}% vs budget` : `${(pct * 100).toFixed(1)}% vs budget (within tolerance)`;
  } else {
    color = "bg-red-500";
    title = `${(pct * 100).toFixed(1)}% vs budget`;
  }

  return (
    <span
      className={cn("inline-block w-2 h-2 rounded-full shrink-0", color)}
      title={title}
    />
  );
}

export function KPICard({ title, value, subtitle, budget, actual, priorYear, sparkData, href }: KPICardProps) {
  return (
    <Link href={href}>
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 hover:border-slate-600 transition-colors cursor-pointer">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-slate-400">{title}</p>
          <TrafficLight actual={actual} budget={budget} />
        </div>
        <p className="text-xl font-bold text-slate-100">{value}</p>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}

        <div className="mt-2 space-y-0.5">
          <Delta label="Budget" actual={actual} target={budget} />
          <Delta label="PY" actual={actual} target={priorYear} />
        </div>

        {sparkData.length > 0 && (
          <div className="mt-2 h-8">
            <MiniSparkline data={sparkData} />
          </div>
        )}
      </div>
    </Link>
  );
}
