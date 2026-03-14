import { NextRequest, NextResponse } from "next/server";
import { parseMcKibbonXLSX } from "@/lib/xlsx-parser";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const confirm = formData.get("confirm") === "true";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseMcKibbonXLSX(buffer, file.name);

    if (!parsed.period) {
      return NextResponse.json(
        { error: "Could not determine period from file. Filename should include MM-YYYY pattern." },
        { status: 400 }
      );
    }

    // Preview mode — just return parsed data
    if (!confirm) {
      return NextResponse.json({ data: parsed });
    }

    // Confirm mode — upsert to Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey || supabaseUrl === "https://YOUR_PROJECT.supabase.co") {
      // Demo mode — just return success
      return NextResponse.json({
        success: true,
        message: "Demo mode — data parsed but not saved (no Supabase configured)",
        data: parsed,
      });
    }

    // Dynamic import to avoid issues when Supabase isn't configured
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, serviceKey);

    const { error } = await supabase
      .from("monthly_periods")
      .upsert(parsed, { onConflict: "period" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log the upload
    await supabase.from("upload_log").insert({
      filename: file.name,
      file_type: "xlsx",
      periods_affected: [parsed.period],
      row_count: 1,
      uploaded_by: "manual",
      status: "success",
    });

    return NextResponse.json({ success: true, data: parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
