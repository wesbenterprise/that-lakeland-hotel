import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

export const isDemoMode =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL === "https://YOUR_PROJECT.supabase.co" ||
  process.env.NEXT_PUBLIC_SUPABASE_URL === "https://placeholder.supabase.co";

// Client-side singleton — safe to construct even without real credentials
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client with service role (for API routes)
export function createServiceClient(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(supabaseUrl, serviceKey);
}
