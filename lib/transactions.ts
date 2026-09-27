import { cents, commissionForSale, type Allocation, type Split } from "@/lib/domain";
import { upsertSheetRow } from "@/lib/sheets";
import { adminDb } from "@/lib/supabase";
import { sendTelegram } from "@/lib/telegram";

type Actor = { id: string; name: string; role: "manager" | "salesperson" | "expense_reporter"; telegram_chat_id: number | null };

export async function actorFromId(id: string): Promise<Actor> {
  const { data, error } = await adminDb().from("employees").select("id,name,role,telegram_chat_id").eq("id", id).single();
  if (error || !data) throw new Error("Choose a valid demonstration employee.");
  return data as Actor;
}

const splitValues = (split: Split) => [split.richard, split.anastasia, split.jeanClaude];

async function syncSale(record: any) {
  await upsertSheetRow("Sales", record.reference, [record.reference, record.submitted_at, record.submitter?.name ?? "", record.customer, record.project, record.description, record.amount_cents / 100,
    `${record.proposed_richard}/${record.proposed_anastasia}/${record.proposed_jean_claude}`, record.status === "approved" ? `${record.approved_richard}/${record.approved_anastasia}/${record.approved_jean_claude}` : "",
    record.status === "approved" ? commissionForSale(record.amount_cents, { richard: Number(record.approved_richard), anastasia: Number(record.approved_anastasia), jeanClaude: Number(record.approved_jean_claude) }).earnings.richard / 100 : 0,
    record.status === "approved" ? commissionForSale(record.amount_cents, { richard: Number(record.approved_richard), anastasia: Number(record.approved_anastasia), jeanClaude: Number(record.approved_jean_claude) }).earnings.anastasia / 100 : 0,
    record.status === "approved" ? commissionForSale(record.amount_cents, { richard: Number(record.approved_richard), anastasia: Number(record.approved_anastasia), jeanClaude: Number(record.approved_jean_claude) }).earnings.jeanClaude / 100 : 0,
    record.status
  ]);
}

async function syncExpense(record: any) {
  await upsertSheetRow("Expenses", record.reference, [record.reference, record.submitted_at, record.submitter?.name ?? "", record.description, record.category, record.amount_cents / 100, record.proposed_allocation, record.final_allocation ?? "", record.status]);
}

async function recordSync(table: "sales" | "expenses", reference: string, sync: () => Promise<void>) {
  const db = adminDb();
  try { await sync(); await db.from(table).update({ sync_status: "synced" }).eq("reference", reference); return { syncStatus: "synced" as const }; }
  catch (error) {
    // Keep secrets out of the UI, but record the provider's message in server logs for safe troubleshooting.
    console.error(`Google Sheets sync failed for ${table} ${reference}:`, error instanceof Error ? error.message : error);
    await db.from(table).update({ sync_status: "failed" }).eq("reference", reference);
    return { syncStatus: "failed" as const, syncError: error instanceof Error ? error.message : "Google Sheets did not accept the update." };
  }
}

export async function submitSale(actorId: string, input: { reference: string; customer: string; project: "A" | "B"; description: string; amount: number; split: Split }, chatId?: number) {
  const actor = await actorFromId(actorId);
  if (actor.role !== "salesperson") throw new Error("Only salespeople can submit sales.");
  const db = adminDb();
  const { data, error } = await db.from("sales").insert({ reference: input.reference, submitted_by: actor.id, telegram_chat_id: chatId ?? actor.telegram_chat_id, customer: input.customer, project: input.project, description: input.description, amount_cents: cents(input.amount), proposed_richard: input.split.richard, proposed_anastasia: input.split.anastasia, proposed_jean_claude: input.split.jeanClaude }).select("*, submitter:employees!submitted_by(name)").single();
  if (error) throw new Error(error.code === "23505" ? "That reference already exists." : error.message);
  const sync = await recordSync("sales", input.reference, () => syncSale(data));
  return { reference: input.reference, status: "pending", ...sync };
}

export async function submitExpense(actorId: string, input: { reference: string; description: string; category: "Materials" | "Travel" | "Other"; amount: number; proposedAllocation: Allocation }, chatId?: number) {
  const actor = await actorFromId(actorId);
  if (actor.role !== "expense_reporter") throw new Error("Only Kevin can submit expenses.");
  const overhead = input.proposedAllocation === "overhead";
  const db = adminDb();
  const { data, error } = await db.from("expenses").insert({ reference: input.reference, submitted_by: actor.id, telegram_chat_id: chatId ?? actor.telegram_chat_id, description: input.description, category: input.category, amount_cents: cents(input.amount), proposed_allocation: input.proposedAllocation, final_allocation: overhead ? "overhead" : null, status: overhead ? "allocated" : "awaiting_allocation" }).select("*, submitter:employees!submitted_by(name)").single();
  if (error) throw new Error(error.code === "23505" ? "That reference already exists." : error.message);
  const sync = await recordSync("expenses", input.reference, () => syncExpense(data));
  return { reference: input.reference, status: overhead ? "allocated" : "awaiting allocation", ...sync };
}

export async function approveSale(actorId: string, reference: string, finalSplit: Split) {
  const actor = await actorFromId(actorId); if (actor.role !== "manager") throw new Error("Only Svetlana can approve sales.");
  const db = adminDb(); const { data: old, error } = await db.from("sales").select("*, submitter:employees!submitted_by(name)").eq("reference", reference).single();
  if (error || !old) throw new Error("Sale not found."); if (old.status === "approved") return { unchanged: true, reference };
  const { data, error: updateError } = await db.from("sales").update({ approved_richard: finalSplit.richard, approved_anastasia: finalSplit.anastasia, approved_jean_claude: finalSplit.jeanClaude, status: "approved", notification_status: old.telegram_chat_id ? "pending" : "not_required" }).eq("reference", reference).select("*, submitter:employees!submitted_by(name)").single();
  if (updateError) throw new Error(updateError.message);
  const sync = await recordSync("sales", reference, () => syncSale(data));
  let notificationStatus = data.notification_status;
  if (data.telegram_chat_id) {
    const commission = commissionForSale(data.amount_cents, finalSplit); const changed = ["richard", "anastasia", "jeanClaude"].some((key) => Number(data[`proposed_${key === "jeanClaude" ? "jean_claude" : key}`]) !== finalSplit[key as keyof Split]);
    try { await sendTelegram(data.telegram_chat_id, `Sale ${reference} approved${changed ? " — commission split changed" : ""}. Sale €${(data.amount_cents / 100).toFixed(2)}; total commission €${(commission.poolCents / 100).toFixed(2)}. Richard: ${finalSplit.richard}% (€${(commission.earnings.richard / 100).toFixed(2)}). Anastasia: ${finalSplit.anastasia}% (€${(commission.earnings.anastasia / 100).toFixed(2)}). Jean-Claude: ${finalSplit.jeanClaude}% (€${(commission.earnings.jeanClaude / 100).toFixed(2)}).`); notificationStatus = "sent"; }
    catch { notificationStatus = "failed"; }
    await db.from("sales").update({ notification_status: notificationStatus }).eq("reference", reference);
  }
  return { reference, ...sync, notificationStatus };
}

export async function approveExpense(actorId: string, reference: string, finalAllocation: Allocation) {
  const actor = await actorFromId(actorId); if (actor.role !== "manager") throw new Error("Only Svetlana can allocate expenses.");
  const db = adminDb(); const { data: old, error } = await db.from("expenses").select("*, submitter:employees!submitted_by(name)").eq("reference", reference).single();
  if (error || !old) throw new Error("Expense not found."); if (old.status === "allocated") return { unchanged: true, reference };
  const { data, error: updateError } = await db.from("expenses").update({ final_allocation: finalAllocation, status: "allocated", notification_status: old.telegram_chat_id ? "pending" : "not_required" }).eq("reference", reference).select("*, submitter:employees!submitted_by(name)").single();
  if (updateError) throw new Error(updateError.message);
  const sync = await recordSync("expenses", reference, () => syncExpense(data));
  let notificationStatus = data.notification_status;
  if (data.telegram_chat_id) {
    try { await sendTelegram(data.telegram_chat_id, `Expense ${reference} ${data.proposed_allocation === finalAllocation ? "allocation confirmed" : "allocation changed"}. €${(data.amount_cents / 100).toFixed(2)}: ${data.description}. Proposed: ${data.proposed_allocation}. Approved: ${finalAllocation}.`); notificationStatus = "sent"; }
    catch { notificationStatus = "failed"; }
    await db.from("expenses").update({ notification_status: notificationStatus }).eq("reference", reference);
  }
  return { reference, ...sync, notificationStatus };
}

export async function retrySync(actorId: string, kind: "sale" | "expense", reference: string) {
  const actor = await actorFromId(actorId); if (actor.role !== "manager") throw new Error("Only Svetlana can retry synchronization.");
  const table = kind === "sale" ? "sales" : "expenses"; const { data, error } = await adminDb().from(table).select("*, submitter:employees!submitted_by(name)").eq("reference", reference).single();
  if (error || !data) throw new Error("Transaction not found.");
  return { reference, ...(await recordSync(table, reference, () => kind === "sale" ? syncSale(data) : syncExpense(data))) };
}

export async function retryNotification(actorId: string, kind: "sale" | "expense", reference: string) {
  const actor = await actorFromId(actorId); if (actor.role !== "manager") throw new Error("Only Svetlana can retry notifications.");
  const table = kind === "sale" ? "sales" : "expenses"; const db = adminDb();
  const { data, error } = await db.from(table).select("*").eq("reference", reference).single();
  if (error || !data) throw new Error("Transaction not found."); if (!data.telegram_chat_id) throw new Error("No Telegram recipient linked.");
  try {
    if (kind === "sale") { const split = { richard: Number(data.approved_richard), anastasia: Number(data.approved_anastasia), jeanClaude: Number(data.approved_jean_claude) }; const earned = commissionForSale(data.amount_cents, split); await sendTelegram(data.telegram_chat_id, `Sale ${reference} approved. Sale €${(data.amount_cents / 100).toFixed(2)}; total commission €${(earned.poolCents / 100).toFixed(2)}. Richard: ${split.richard}% (€${(earned.earnings.richard / 100).toFixed(2)}). Anastasia: ${split.anastasia}% (€${(earned.earnings.anastasia / 100).toFixed(2)}). Jean-Claude: ${split.jeanClaude}% (€${(earned.earnings.jeanClaude / 100).toFixed(2)}).`); }
    else await sendTelegram(data.telegram_chat_id, `Expense ${reference} allocation confirmed. €${(data.amount_cents / 100).toFixed(2)}: ${data.description}. Proposed: ${data.proposed_allocation}. Approved: ${data.final_allocation}.`);
    await db.from(table).update({ notification_status: "sent" }).eq("reference", reference); return { reference, notificationStatus: "sent" };
  } catch { await db.from(table).update({ notification_status: "failed" }).eq("reference", reference); return { reference, notificationStatus: "failed" }; }
}
