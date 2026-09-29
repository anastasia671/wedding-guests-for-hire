import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase";

export async function GET() {
  // IDs are all the demonstration selector needs. Telegram identifiers stay
  // server-only, alongside the bot token and database credentials.
  const { data, error } = await adminDb().from("employees").select("id,name,role").order("name");
  return NextResponse.json(error ? { error: error.message } : { employees: data }, { status: error ? 500 : 200 });
}
