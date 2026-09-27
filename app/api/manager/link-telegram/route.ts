import { NextRequest, NextResponse } from "next/server";
import { actorFromId } from "@/lib/transactions";
import { adminDb } from "@/lib/supabase";
import { z } from "zod";

const input = z.object({ actorId: z.string().uuid(), employeeId: z.string().uuid(), telegramUserId: z.coerce.number().int().positive() });

export async function POST(request: NextRequest) {
  try {
    const value = input.parse(await request.json()); const actor = await actorFromId(value.actorId);
    if (actor.role !== "manager") throw new Error("Only Svetlana can link Telegram accounts.");
    const db = adminDb();
    // A Telegram account can represent one demonstration employee at a time.
    // Move it cleanly when the manager changes from a salesperson to Kevin.
    const { error: unlinkError } = await db.from("employees").update({ telegram_user_id: null, telegram_chat_id: null }).eq("telegram_user_id", value.telegramUserId).neq("id", value.employeeId);
    if (unlinkError) throw new Error(unlinkError.message);
    const { error } = await db.from("employees").update({ telegram_user_id: value.telegramUserId }).eq("id", value.employeeId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not link Telegram account." }, { status: 400 }); }
}
