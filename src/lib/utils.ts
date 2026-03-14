import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format cents to dollar string */
export function formatCurrency(cents: number | null | undefined, abbreviated = false): string {
  if (cents == null) return "—";
  const dollars = cents / 100;
  if (abbreviated) {
    if (Math.abs(dollars) >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
    if (Math.abs(dollars) >= 1_000) return `$${(dollars / 1_000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(dollars);
}

/** Format decimal as percentage */
export function formatPct(val: number | null | undefined): string {
  if (val == null) return "—";
  return `${(val * 100).toFixed(1)}%`;
}

/** Calculate variance and direction */
export function variance(actual: number | null, target: number | null): { delta: number; pct: number; favorable: boolean } | null {
  if (actual == null || target == null || target === 0) return null;
  const delta = actual - target;
  const pct = delta / Math.abs(target);
  return { delta, pct, favorable: delta >= 0 };
}

/** Expense variance — under budget is favorable */
export function expenseVariance(actual: number | null, budget: number | null): { delta: number; pct: number; favorable: boolean } | null {
  const v = variance(actual, budget);
  if (!v) return null;
  return { ...v, favorable: v.delta <= 0 };
}

/** Format relative time */
export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export function monthName(month: number): string {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month - 1] ?? "";
}

export function fullMonthName(month: number): string {
  return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month - 1] ?? "";
}
