import { createClient } from "@supabase/supabase-js";

export function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prefer the legacy service-role JWT when supplied. It reliably bypasses RLS
  // for server-only API routes, while browser requests remain protected by RLS.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) throw new Error("Supabase server settings are missing.");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
