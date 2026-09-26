import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await adminDb().from("employees").select("id,name,role,telegram_user_id,telegram_chat_id").order("name");
  return NextResponse.json(error ? { error: error.message } : { employees: data }, { status: error ? 500 : 200 });
}
