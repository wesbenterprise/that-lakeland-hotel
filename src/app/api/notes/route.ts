import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period");
  if (!period) {
    return NextResponse.json({ error: "period required" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ note: null });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, serviceKey);

    // Match period like "2026-02" → "2026-02-01"
    const periodDate = period.length === 7 ? `${period}-01` : period;

    const { data, error } = await supabase
      .from("period_notes")
      .select("note, updated_at")
      .eq("period", periodDate)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ note: null });
    return NextResponse.json({ note: data?.note ?? null, updated_at: data?.updated_at ?? null });
  } catch {
    return NextResponse.json({ note: null });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { period, note } = body;

  if (!period || note === undefined) {
    return NextResponse.json({ error: "period and note required" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, serviceKey);

    const periodDate = period.length === 7 ? `${period}-01` : period;

    // Upsert: if note exists for this period, update it; otherwise insert
    const { error } = await supabase
      .from("period_notes")
      .upsert(
        { period: periodDate, note, updated_at: new Date().toISOString() },
        { onConflict: "period" }
      );

    if (error) {
      // If upsert fails (no unique constraint), try delete+insert
      await supabase.from("period_notes").delete().eq("period", periodDate);
      await supabase.from("period_notes").insert({ period: periodDate, note });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
