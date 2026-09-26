import { NextRequest, NextResponse } from "next/server";
import { actorFromId } from "@/lib/transactions";
import { adminDb } from "@/lib/supabase";
import { z } from "zod";

const input = z.object({ actorId: z.string().uuid(), employeeId: z.string().uuid(), telegramUserId: z.coerce.number().int().positive() });

export async function POST(request: NextRequest) {
  try {
    const value = input.parse(await request.json()); const actor = await actorFromId(value.actorId);
    if (actor.role !== "manager") throw new Error("Only Svetlana can link Telegram accounts.");
    const { error } = await adminDb().from("employees").update({ telegram_user_id: value.telegramUserId }).eq("id", value.employeeId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not link Telegram account." }, { status: 400 }); }
}
