import { NextResponse } from "next/server";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface YearRow {
  year: number;
  total_revenue: number;
  gop: number;
  nop: number;
  room_revenue: number;
  rooms_sold: number;
  rooms_available: number;
  gop_pct: number;
  nop_pct: number;
  revpar: number;
  adr: number;
  occupancy: number;
  months: number;
}

export interface YearlyMetric {
  label: string;
  format: "currency" | "percent" | "integer";
  indent?: boolean;
  values: Record<string, number>;
}

/**
 * YoY-trend projection for a partial year.
 * Logic: take the growth rate seen in the completed months vs the same
 * months of the prior full year, then apply that rate to the full prior year.
 * e.g. Jan-Feb 2026 is +2.4% above Jan-Feb 2025 → project 2026 = 2025_full × 1.024
 */
export interface PartialYearProjection {
  priorYear: number;
  priorYtdRevenue: number;    // prior year same-N-months revenue (dollars)
  priorYtdNop: number | null;
  priorFullYearRevenue: number; // prior full year revenue (dollars)
  priorFullYearNop: number | null;
  ytdGrowthPct: number;         // e.g. 0.024 = +2.4%
  projectedRevenue: number;     // priorFullYear × (1 + ytdGrowthPct)
  projectedNop: number | null;
}

export interface YearlyResponse {
  years: number[];
  metrics: YearlyMetric[];
  partialYears?: Record<number, string>;
  /** YoY-trend-based full-year projection for the current partial year. */
  projection?: PartialYearProjection;
}

// ─── Shape builder ────────────────────────────────────────────────────────────

function buildResponse(
  rows: YearRow[],
  partialYears?: Record<number, string>,
  projection?: PartialYearProjection
): YearlyResponse {
  const years = rows.map((r) => r.year);

  const val = (key: keyof YearRow) =>
    Object.fromEntries(rows.map((r) => [String(r.year), r[key] as number]));

  const metrics: YearlyMetric[] = [
    { label: "Total Revenue", format: "currency", values: val("total_revenue") },
    { label: "GOP", format: "currency", values: val("gop") },
    { label: "GOP %", format: "percent", indent: true, values: val("gop_pct") },
    { label: "NOP", format: "currency", values: val("nop") },
    { label: "NOP %", format: "percent", indent: true, values: val("nop_pct") },
    { label: "RevPAR", format: "currency", values: val("revpar") },
    { label: "ADR", format: "currency", values: val("adr") },
    { label: "Occupancy", format: "percent", values: val("occupancy") },
    { label: "Room Revenue", format: "currency", values: val("room_revenue") },
    { label: "Rooms Sold", format: "integer", values: val("rooms_sold") },
    { label: "Months of Data", format: "integer", values: val("months") },
  ];

  return {
    years,
    metrics,
    ...(partialYears ? { partialYears } : {}),
    ...(projection ? { projection } : {}),
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey || supabaseUrl === "https://YOUR_PROJECT.supabase.co") {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, serviceKey);

    // Select year column directly — avoids period string parsing issues
    const { data: monthly, error: mErr } = await supabase
      .from("monthly_periods")
      .select(
        "year,month,total_revenue,gross_operating_profit,nop_hotel,room_revenue,rooms_sold,rooms_available"
      )
      .order("year", { ascending: true })
      .order("month", { ascending: true });

    if (mErr) {
      return NextResponse.json({ error: mErr.message }, { status: 500 });
    }

    // ── Build monthly lookup for seasonality ──────────────────────────────────
    // Key: `${year}-${month}` → { revenue, nop }
    const byYearMonth: Record<string, { revenue: number; nop: number }> = {};

    // Aggregate by year in JS using the integer `year` column directly
    const byYear: Record<
      number,
      {
        total_revenue: number;
        gop: number;
        nop: number;
        room_revenue: number;
        rooms_sold: number;
        rooms_available: number;
        months: number;
      }
    > = {};

    for (const row of monthly ?? []) {
      const year = row.year as number; // integer column — no parsing needed
      if (!Number.isFinite(year)) continue;

      if (!byYear[year]) {
        byYear[year] = {
          total_revenue: 0,
          gop: 0,
          nop: 0,
          room_revenue: 0,
          rooms_sold: 0,
          rooms_available: 0,
          months: 0,
        };
      }
      byYear[year].total_revenue += row.total_revenue ?? 0;
      byYear[year].gop += row.gross_operating_profit ?? 0;
      byYear[year].nop += row.nop_hotel ?? 0;
      byYear[year].room_revenue += Math.abs(row.room_revenue ?? 0); // abs for early data with sign issues
      byYear[year].rooms_sold += row.rooms_sold ?? 0;
      byYear[year].rooms_available += row.rooms_available ?? 0;
      byYear[year].months += 1;

      // Track monthly breakdown for seasonality
      const monthKey = `${year}-${row.month as number}`;
      byYearMonth[monthKey] = {
        revenue: (row.total_revenue ?? 0),
        nop: (row.nop_hotel ?? 0),
      };
    }

    const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const currentYear = new Date().getFullYear();

    const rows: YearRow[] = Object.entries(byYear)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([yr, agg]) => {
        const year = Number(yr);
        const gop_pct = agg.total_revenue > 0 ? agg.gop / agg.total_revenue : 0;
        const nop_pct = agg.total_revenue > 0 ? agg.nop / agg.total_revenue : 0;
        const revpar =
          agg.rooms_available > 0
            ? (agg.room_revenue / 100) / agg.rooms_available
            : 0;
        const adr =
          agg.rooms_sold > 0
            ? (agg.room_revenue / 100) / agg.rooms_sold
            : 0;
        const occupancy =
          agg.rooms_available > 0 ? agg.rooms_sold / agg.rooms_available : 0;

        return {
          year,
          total_revenue: agg.total_revenue / 100,
          gop: agg.gop / 100,
          nop: agg.nop / 100,
          room_revenue: agg.room_revenue / 100,
          rooms_sold: agg.rooms_sold,
          rooms_available: agg.rooms_available,
          gop_pct,
          nop_pct,
          revpar,
          adr,
          occupancy,
          months: agg.months,
        };
      });

    // ── YoY-trend projection for partial year ────────────────────────────────
    // Find the current partial year and the most recent complete prior year.
    // Compute: priorFullYear × (ytd_current / priorYear_same_months)
    const partialRow = rows.find((r) => r.year === currentYear && r.months < 12);
    let projection: PartialYearProjection | undefined;

    if (partialRow) {
      const COVID_YEAR = 2020;
      // Find most recent complete prior year (not COVID, not current)
      const priorComplete = rows
        .filter((r) => r.months === 12 && r.year !== COVID_YEAR && r.year < currentYear)
        .sort((a, b) => b.year - a.year)[0];

      if (priorComplete) {
        const completedMonths = partialRow.months;

        // Sum the same N months from the prior complete year
        let priorYtdRev = 0;
        let priorYtdNop = 0;
        for (let m = 1; m <= completedMonths; m++) {
          const key = `${priorComplete.year}-${m}`;
          priorYtdRev += byYearMonth[key]?.revenue ?? 0;
          priorYtdNop += byYearMonth[key]?.nop ?? 0;
        }

        // Current YTD (in cents)
        let ytdRev = 0;
        let ytdNop = 0;
        for (let m = 1; m <= completedMonths; m++) {
          const key = `${currentYear}-${m}`;
          ytdRev += byYearMonth[key]?.revenue ?? 0;
          ytdNop += byYearMonth[key]?.nop ?? 0;
        }

        if (priorYtdRev > 0 && ytdRev > 0) {
          const growthPct = (ytdRev - priorYtdRev) / priorYtdRev;
          const priorFullRev = priorComplete.total_revenue; // already in dollars
          const priorFullNop = priorComplete.nop;

          projection = {
            priorYear: priorComplete.year,
            priorYtdRevenue: priorYtdRev / 100,
            priorYtdNop: priorYtdNop !== 0 ? priorYtdNop / 100 : null,
            priorFullYearRevenue: priorFullRev,
            priorFullYearNop: priorFullNop,
            ytdGrowthPct: growthPct,
            projectedRevenue: priorFullRev * (1 + growthPct),
            projectedNop: priorFullNop ? priorFullNop * (1 + growthPct) : null,
          };
        }
      }
    }

    // Build partial year annotations
    const partial: Record<number, string> = {};
    for (const row of rows) {
      if (row.months < 12) {
        const lastMonth = row.months - 1; // 0-indexed
        partial[row.year] = `${MONTH_NAMES[0]}–${MONTH_NAMES[lastMonth]} only (${row.months} months)`;
      }
    }

    return NextResponse.json(buildResponse(
      rows,
      Object.keys(partial).length > 0 ? partial : undefined,
      projection
    ));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
