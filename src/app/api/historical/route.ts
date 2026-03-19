import { NextResponse } from "next/server";

// ─── Types ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export interface MonthPoint {
  month: number;      // 1–12
  monthName: string;  // "Jan" … "Dec"
  average: number | null;   // historical mean (all complete years exc. COVID)
  lastYear: number | null;  // most recent complete year
  ttm: number | null;       // trailing 12 months
}

export interface HistoricalMetric {
  key: string;
  label: string;
  /** "currency" = cents→dollars (large, K/M scale)
   *  "dollar"   = cents→dollars (small, ADR/RevPAR scale)
   *  "percent"  = decimal×100  */
  type: "currency" | "dollar" | "percent";
  monthly: MonthPoint[];
}

export interface HistoricalResponse {
  metrics: HistoricalMetric[];
  averageYears: number[];   // years included in the historical average
  lastYear: number;
  ttmLabel: string;         // e.g. "Mar 2025 – Feb 2026"
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey || supabaseUrl === "https://YOUR_PROJECT.supabase.co") {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: rows, error } = await supabase
      .from("monthly_periods")
      .select(
        "year,month,total_revenue,room_revenue,gross_operating_profit,nop_hotel,revpar,adr,occupancy_pct,gop_pct,nop_pct"
      )
      .order("year",  { ascending: true })
      .order("month", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!rows || rows.length === 0) return NextResponse.json({ error: "No data" }, { status: 404 });

    // ── Identify year buckets ─────────────────────────────────────────────────
    const COVID_YEAR = 2020;
    const currentYear = new Date().getFullYear();

    // Count months per year
    const monthsPerYear: Record<number, number> = {};
    for (const r of rows) {
      monthsPerYear[r.year as number] = (monthsPerYear[r.year as number] ?? 0) + 1;
    }
    const completeYears = Object.entries(monthsPerYear)
      .filter(([yr, cnt]) => cnt === 12 && Number(yr) !== COVID_YEAR)
      .map(([yr]) => Number(yr))
      .sort((a, b) => a - b);

    const lastYear = completeYears[completeYears.length - 1] ?? currentYear - 1;
    const averageYears = completeYears.filter((y) => y !== lastYear); // avg = all complete except the most recent

    // ── TTM: the 12 most recent rows ─────────────────────────────────────────
    const allSorted = [...rows].sort((a, b) => {
      if ((a.year as number) !== (b.year as number)) return (b.year as number) - (a.year as number);
      return (b.month as number) - (a.month as number);
    });
    const ttmRows = allSorted.slice(0, 12);
    const ttmByMonth: Record<number, typeof rows[0]> = {};
    for (const r of ttmRows) ttmByMonth[r.month as number] = r;

    // TTM label
    const ttmOldest = ttmRows[ttmRows.length - 1];
    const ttmNewest = ttmRows[0];
    const ttmLabel = `${MONTH_NAMES[(ttmOldest.month as number) - 1]} ${ttmOldest.year} – ${MONTH_NAMES[(ttmNewest.month as number) - 1]} ${ttmNewest.year}`;

    // ── Per-year, per-month lookup ────────────────────────────────────────────
    type RowType = typeof rows[0];
    const byYearMonth: Record<string, RowType> = {};
    for (const r of rows) {
      byYearMonth[`${r.year}-${r.month}`] = r;
    }

    // ── Metric definitions ────────────────────────────────────────────────────
    type MetricDef = {
      key: string;
      label: string;
      type: "currency" | "dollar" | "percent";
      field: keyof RowType;
    };

    const METRICS: MetricDef[] = [
      { key: "total_revenue",         label: "Total Revenue",  type: "currency", field: "total_revenue" },
      { key: "room_revenue",          label: "Room Revenue",   type: "currency", field: "room_revenue" },
      { key: "gross_operating_profit",label: "GOP",            type: "currency", field: "gross_operating_profit" },
      { key: "nop_hotel",             label: "NOP",            type: "currency", field: "nop_hotel" },
      { key: "revpar",                label: "RevPAR",         type: "dollar",   field: "revpar" },
      { key: "adr",                   label: "ADR",            type: "dollar",   field: "adr" },
      { key: "occupancy_pct",         label: "Occupancy",      type: "percent",  field: "occupancy_pct" },
      { key: "gop_pct",               label: "GOP %",          type: "percent",  field: "gop_pct" },
      { key: "nop_pct",               label: "NOP %",          type: "percent",  field: "nop_pct" },
    ];

    const raw = (r: RowType | undefined, field: keyof RowType): number | null => {
      if (!r) return null;
      const v = r[field];
      return typeof v === "number" ? v : null;
    };

    // ── Build monthly data per metric ─────────────────────────────────────────
    const metrics: HistoricalMetric[] = METRICS.map((m) => {
      const monthly: MonthPoint[] = [];

      for (let mo = 1; mo <= 12; mo++) {
        // Historical average across all "average" years
        const avgVals = averageYears
          .map((yr) => raw(byYearMonth[`${yr}-${mo}`], m.field))
          .filter((v): v is number => v != null);
        const avg = avgVals.length > 0 ? avgVals.reduce((s, v) => s + v, 0) / avgVals.length : null;

        // Last year
        const ly = raw(byYearMonth[`${lastYear}-${mo}`], m.field);

        // TTM (month slot from the trailing 12, not necessarily same calendar year)
        const ttm = raw(ttmByMonth[mo], m.field);

        monthly.push({
          month: mo,
          monthName: MONTH_NAMES[mo - 1],
          average: avg,
          lastYear: ly,
          ttm,
        });
      }

      return { key: m.key, label: m.label, type: m.type, monthly };
    });

    return NextResponse.json({
      metrics,
      averageYears,
      lastYear,
      ttmLabel,
    } satisfies HistoricalResponse);

  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
