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
    if (Math.abs(dollars) >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(3)}M`;
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

// ─── Year Summary ─────────────────────────────────────────────────────────────

export interface YearSummary {
  year: number;
  months: number;           // number of data months present (< 12 = partial)
  revenue: number;          // total_revenue sum, cents
  expense: number;          // sum of 9 expense fields, cents
  nop: number;              // nop_hotel sum, cents
  gop: number;              // gross_operating_profit sum, cents
  nopPct: number;           // nop / revenue (0..1 decimal)
  gopPct: number;           // gop / revenue (0..1 decimal)
  isPartial: boolean;
  annualizedRevenue: number;    // revenue * (12 / months), for partial years
  annualizedExpense: number;
}

/**
 * Aggregate monthly_periods rows into per-year summaries.
 * - All monetary values remain in cents.
 * - Total expense = rooms_expense + fb_expense + admin_general + sales_marketing
 *   + property_ops_maintenance + utilities + management_fees + property_taxes + insurance
 * - Null-coerces all expense fields to 0.
 * - isPartial = months < 12.
 * - annualized values scale partial years to 12-month equivalent.
 */
export function aggregateByYear(data: import("./types").MonthlyPeriod[]): YearSummary[] {
  const map = new Map<number, {
    revenue: number; expense: number; nop: number; gop: number; months: number;
  }>();

  for (const p of data) {
    const yr = p.year;
    if (!map.has(yr)) map.set(yr, { revenue: 0, expense: 0, nop: 0, gop: 0, months: 0 });
    const agg = map.get(yr)!;

    agg.revenue += p.total_revenue ?? 0;
    agg.gop     += p.gross_operating_profit ?? 0;
    agg.nop     += p.nop_hotel ?? 0;
    agg.expense +=
      (p.rooms_expense              ?? 0) +
      (p.fb_expense                 ?? 0) +
      (p.admin_general              ?? 0) +
      (p.sales_marketing            ?? 0) +
      (p.property_ops_maintenance   ?? 0) +
      (p.utilities                  ?? 0) +
      (p.management_fees            ?? 0) +
      (p.property_taxes             ?? 0) +
      (p.insurance                  ?? 0);
    agg.months++;
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, agg]) => {
      const isPartial = agg.months < 12;
      const scale = isPartial ? 12 / agg.months : 1;
      return {
        year,
        months: agg.months,
        revenue: agg.revenue,
        expense: agg.expense,
        nop: agg.nop,
        gop: agg.gop,
        nopPct: agg.revenue > 0 ? agg.nop / agg.revenue : 0,
        gopPct: agg.revenue > 0 ? agg.gop / agg.revenue : 0,
        isPartial,
        annualizedRevenue: agg.revenue * scale,
        annualizedExpense: agg.expense * scale,
      };
    });
}
