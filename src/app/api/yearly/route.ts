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
  demo?: boolean;
}

// ─── Demo data ────────────────────────────────────────────────────────────────
// 130-room Marriott SpringHill Suites Lakeland FL
// Base 2022, 4% YoY growth, 2026 = Jan–Feb only (2/12 of full year)

function buildDemoData(): YearlyResponse {
  const ROOMS = 130;
  const DAYS_PER_YEAR = 365;

  // 2022 base values (in dollars, not cents)
  const base = {
    total_revenue: 8_200_000,
    gop: 4_600_000,
    gop_pct: 0.561,
    nop: 3_100_000,
    nop_pct: 0.378,
    occupancy: 0.838,
    adr: 198,
  };

  const GROWTH = 1.04;

  const rows: YearRow[] = [];

  for (let i = 0; i < 4; i++) {
    const year = 2022 + i;
    const factor = Math.pow(GROWTH, i);

    const total_revenue = Math.round(base.total_revenue * factor);
    const gop = Math.round(base.gop * factor);
    const nop = Math.round(base.nop * factor);
    const gop_pct = parseFloat((base.gop_pct + i * 0.003).toFixed(4));
    const nop_pct = parseFloat((base.nop_pct + i * 0.003).toFixed(4));
    const occupancy = parseFloat((base.occupancy + i * 0.001).toFixed(4));
    const adr = Math.round(base.adr * factor);

    const rooms_available = ROOMS * DAYS_PER_YEAR;
    const rooms_sold = Math.round(occupancy * rooms_available);
    const room_revenue = Math.round(adr * rooms_sold);
    const revpar = parseFloat((adr * occupancy).toFixed(2));

    rows.push({
      year,
      total_revenue,
      gop,
      nop,
      room_revenue,
      rooms_sold,
      rooms_available,
      gop_pct,
      nop_pct,
      revpar,
      adr,
      occupancy,
    });
  }

  // 2026 — partial year (Jan–Feb, 2/12)
  {
    const factor = Math.pow(GROWTH, 4);
    const PARTIAL_MONTHS = 2;
    const PARTIAL_DAYS = 31 + 28; // Jan + Feb (non-leap)
    const prorate = PARTIAL_MONTHS / 12;

    const full_total_revenue = base.total_revenue * factor;
    const full_gop = base.gop * factor;
    const full_nop = base.nop * factor;
    const full_adr = base.adr * factor;
    const occupancy = parseFloat((base.occupancy + 4 * 0.001 + 0.05).toFixed(4)); // slightly higher in winter
    const rooms_available = ROOMS * PARTIAL_DAYS;
    const rooms_sold = Math.round(occupancy * rooms_available);
    const room_revenue = Math.round(full_adr * rooms_sold);

    rows.push({
      year: 2026,
      total_revenue: Math.round(full_total_revenue * prorate),
      gop: Math.round(full_gop * prorate),
      nop: Math.round(full_nop * prorate),
      room_revenue,
      rooms_sold,
      rooms_available,
      gop_pct: parseFloat((base.gop_pct + 4 * 0.003 - 0.015).toFixed(4)),
      nop_pct: parseFloat((base.nop_pct + 4 * 0.003 - 0.024).toFixed(4)),
      revpar: parseFloat((full_adr * occupancy).toFixed(2)),
      adr: Math.round(full_adr),
      occupancy,
    });
  }

  return buildResponse(rows, { 2026: "Jan–Feb only" }, true);
}

// ─── Shape builder ────────────────────────────────────────────────────────────

function buildResponse(
  rows: YearRow[],
  partialYears?: Record<number, string>,
  demo?: boolean
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
  ];

  return { years, metrics, ...(partialYears ? { partialYears } : {}), ...(demo ? { demo } : {}) };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const isDemo =
    !supabaseUrl ||
    !serviceKey ||
    supabaseUrl === "https://YOUR_PROJECT.supabase.co";

  if (isDemo) {
    return NextResponse.json(buildDemoData());
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, serviceKey);

    // Raw aggregate query via RPC / raw SQL
    const { data, error } = await supabase.rpc("yearly_summary");

    if (error) {
      // If RPC not set up, fall back to manual aggregation via monthly_periods
      const { data: monthly, error: mErr } = await supabase
        .from("monthly_periods")
        .select(
          "period,total_revenue,gross_operating_profit,nop_hotel,room_revenue,rooms_sold,rooms_available"
        )
        .order("period", { ascending: true });

      if (mErr) {
        return NextResponse.json({ error: mErr.message }, { status: 500 });
      }

      // Aggregate by year in JS
      const byYear: Record<
        number,
        {
          total_revenue: number;
          gop: number;
          nop: number;
          room_revenue: number;
          rooms_sold: number;
          rooms_available: number;
        }
      > = {};

      for (const row of monthly ?? []) {
        const year = new Date(row.period + "-01").getFullYear();
        if (!byYear[year]) {
          byYear[year] = {
            total_revenue: 0,
            gop: 0,
            nop: 0,
            room_revenue: 0,
            rooms_sold: 0,
            rooms_available: 0,
          };
        }
        byYear[year].total_revenue += row.total_revenue ?? 0;
        byYear[year].gop += row.gross_operating_profit ?? 0;
        byYear[year].nop += row.nop_hotel ?? 0;
        byYear[year].room_revenue += row.room_revenue ?? 0;
        byYear[year].rooms_sold += row.rooms_sold ?? 0;
        byYear[year].rooms_available += row.rooms_available ?? 0;
      }

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
            // Convert cents → dollars
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
          };
        });

      // Detect partial current year (< 12 months)
      const currentYear = new Date().getFullYear();
      const monthsThisYear = (monthly ?? []).filter(
        (r) => new Date(r.period + "-01").getFullYear() === currentYear
      ).length;

      const partial: Record<number, string> | undefined =
        monthsThisYear > 0 && monthsThisYear < 12
          ? { [currentYear]: `Jan–${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][monthsThisYear - 1]} only` }
          : undefined;

      return NextResponse.json(buildResponse(rows, partial));
    }

    // RPC succeeded — data is already shaped as YearRow[]
    return NextResponse.json(buildResponse(data as YearRow[]));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
