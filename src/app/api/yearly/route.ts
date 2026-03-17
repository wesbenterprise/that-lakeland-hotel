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

export interface YearlyResponse {
  years: number[];
  metrics: YearlyMetric[];
  partialYears?: Record<number, string>;
}

// ─── Shape builder ────────────────────────────────────────────────────────────

function buildResponse(
  rows: YearRow[],
  partialYears?: Record<number, string>
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

  return { years, metrics, ...(partialYears ? { partialYears } : {}) };
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

    // Build partial year annotations
    const partial: Record<number, string> = {};
    for (const row of rows) {
      if (row.months < 12) {
        const lastMonth = row.months - 1; // 0-indexed
        partial[row.year] = `${MONTH_NAMES[0]}–${MONTH_NAMES[lastMonth]} only (${row.months} months)`;
      }
    }

    return NextResponse.json(buildResponse(rows, Object.keys(partial).length > 0 ? partial : undefined));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
