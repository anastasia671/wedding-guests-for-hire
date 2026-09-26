import { createClient } from "@supabase/supabase-js";

function credentialType(key: string | undefined) {
  if (!key) return "missing";
  if (key.startsWith("sb_secret_")) return "secret API key";
  if (!key.includes(".")) return "unknown key";
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
    return payload.role ?? "unknown JWT role";
  } catch {
    return "unknown JWT role";
  }
}

export function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prefer the legacy service-role JWT when supplied. It reliably bypasses RLS
  // for server-only API routes, while browser requests remain protected by RLS.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) throw new Error("Supabase server settings are missing.");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export function serverCredentialType() {
  return credentialType(process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY);
}
