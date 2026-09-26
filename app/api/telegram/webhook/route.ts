import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase";
import { sendTelegram } from "@/lib/telegram";
import { submitExpense, submitSale } from "@/lib/transactions";

/** Telegram sends updates here. The manager links users on the website; users can then receive decisions. */
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) return new NextResponse("Unauthorized", { status: 401 });
  const update = await request.json(); const message = update.message;
  if (!message?.from?.id || !message?.chat?.id) return NextResponse.json({ ok: true });
  const db = adminDb(); const { data: employee } = await db.from("employees").select("id,name").eq("telegram_user_id", message.from.id).single();
  if (!employee) { await sendTelegram(message.chat.id, "Your Telegram account is not linked to a fictional employee. Ask Svetlana to link it in Manager setup."); return NextResponse.json({ ok: true }); }
  await db.from("employees").update({ telegram_chat_id: message.chat.id }).eq("id", employee.id);
  const text = String(message.text ?? "").trim();
  try {
    // Deliberately simple, documented commands make the actual-bot test reproducible.
    // /sale S01|Olivia Rose|A|One proud uncle|1000|50|30|20
    // /expense E01|Rented suit|Materials|120|A
    if (text.startsWith("/sale ")) {
      const [reference, customer, project, description, amount, richard, anastasia, jeanClaude] = text.slice(6).split("|").map((value: string) => value.trim());
      const result = await submitSale(employee.id, { reference, customer, project: project as "A" | "B", description, amount: Number(amount), split: { richard: Number(richard), anastasia: Number(anastasia), jeanClaude: Number(jeanClaude) } }, message.chat.id);
      await sendTelegram(message.chat.id, `${result.reference} saved: €${Number(amount).toFixed(2)}, project ${project}, status Pending approval. Sheets sync: ${result.syncStatus}.`);
    } else if (text.startsWith("/expense ")) {
      const [reference, description, category, amount, proposedAllocation] = text.slice(9).split("|").map((value: string) => value.trim());
      const result = await submitExpense(employee.id, { reference, description, category: category as "Materials" | "Travel" | "Other", amount: Number(amount), proposedAllocation: proposedAllocation as "A" | "B" | "overhead" }, message.chat.id);
      await sendTelegram(message.chat.id, `${result.reference} saved: €${Number(amount).toFixed(2)}, proposed allocation ${proposedAllocation}, status ${result.status}. Sheets sync: ${result.syncStatus}.`);
    } else {
      await sendTelegram(message.chat.id, "Commands: /sale REF|CUSTOMER|A or B|DESCRIPTION|AMOUNT|RICHARD%|ANASTASIA%|JEAN-CLAUDE%  or /expense REF|DESCRIPTION|Materials, Travel, or Other|AMOUNT|A, B, or overhead");
    }
  } catch (error) { await sendTelegram(message.chat.id, `Not recorded. ${error instanceof Error ? error.message : "Please correct the transaction."}`); }
  return NextResponse.json({ ok: true });
}
