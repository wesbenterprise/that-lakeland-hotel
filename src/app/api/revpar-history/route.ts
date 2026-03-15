import { NextResponse } from "next/server";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function syntheticRevPar(): { years: number[]; data: Array<Record<string, number | string>> } {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-indexed
  const years: number[] = [];
  for (let i = 4; i >= 0; i--) {
    years.push(currentYear - i);
  }

  // Base seasonal pattern (12 months) for a 130-room SpringHill Suites Lakeland FL
  // Base ~$160, peaks Jan-Mar, summer dip, fall recovery
  const basePattern = [
    192, 198, 188, 175, 162, 148, 150, 152, 158, 165, 170, 180,
  ];

  // Build data — each row is one month, columns are years
  const data: Array<Record<string, number | string>> = [];
  for (let m = 0; m < 12; m++) {
    const row: Record<string, number | string> = {
      month: m + 1,
      label: MONTH_LABELS[m],
    };
    for (let yi = 0; yi < years.length; yi++) {
      const year = years[yi];
      // 3-5% YoY growth compounding from 2022 base (index 0)
      const growthFactor = Math.pow(1.04, yi);
      const base = basePattern[m] * growthFactor;
      // Add slight random noise (±2%) — deterministic via year+month seed
      const noise = 1 + (((year * 31 + m * 17) % 7) - 3) * 0.007;
      const revpar = +(base * noise).toFixed(2);

      // Partial year: current year only up to last complete month
      if (year === currentYear && m + 1 > currentMonth - 1) {
        // Don't include months that haven't been fully reported yet
        // For demo, assume we have data through last month
        row[String(year)] = undefined as unknown as number;
      } else {
        row[String(year)] = revpar;
      }
    }
    data.push(row);
  }

  return { years, data };
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const isDemo =
    !supabaseUrl ||
    !serviceKey ||
    supabaseUrl === "https://YOUR_PROJECT.supabase.co";

  if (isDemo) {
    return NextResponse.json(syntheticRevPar());
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl!, serviceKey!);

    const currentYear = new Date().getFullYear();
    const minYear = currentYear - 4;

    // Fetch rows where period year >= minYear
    // period is YYYY-MM-DD; revpar stored in cents
    const { data: rows, error } = await supabase
      .from("monthly_periods")
      .select("period, revpar")
      .gte("period", `${minYear}-01-01`)
      .order("period", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build year/month structure
    const yearSet = new Set<number>();
    const map: Record<string, Record<number, number>> = {}; // month -> year -> revpar

    for (const row of rows ?? []) {
      const d = new Date(row.period);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      yearSet.add(year);
      if (!map[month]) map[month] = {};
      if (row.revpar != null) {
        map[month][year] = +(row.revpar / 100).toFixed(2);
      }
    }

    const years = Array.from(yearSet).sort();
    const data: Array<Record<string, number | string>> = [];

    for (let m = 1; m <= 12; m++) {
      const row: Record<string, number | string> = {
        month: m,
        label: MONTH_LABELS[m - 1],
      };
      for (const year of years) {
        const val = map[m]?.[year];
        if (val !== undefined) row[String(year)] = val;
      }
      data.push(row);
    }

    return NextResponse.json({ years, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
