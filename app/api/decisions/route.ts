import { NextRequest, NextResponse } from "next/server";
import { approveExpense, approveSale, retryNotification, retrySync } from "@/lib/transactions";
import { z } from "zod";

const split = z.object({ richard: z.number().min(0).max(100), anastasia: z.number().min(0).max(100), jeanClaude: z.number().min(0).max(100) }).refine((s) => s.richard + s.anastasia + s.jeanClaude === 100, "Commission shares must total 100%.");

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.actorId) throw new Error("Choose a demonstration role.");
    const result = body.action === "approve-sale" ? await approveSale(body.actorId, body.reference, split.parse(body.split))
      : body.action === "approve-expense" ? await approveExpense(body.actorId, body.reference, z.enum(["A", "B", "overhead"]).parse(body.allocation))
      : body.action === "retry-sync" ? await retrySync(body.actorId, z.enum(["sale", "expense"]).parse(body.kind), body.reference)
      : body.action === "retry-notification" ? await retryNotification(body.actorId, z.enum(["sale", "expense"]).parse(body.kind), body.reference)
      : (() => { throw new Error("Unknown manager action."); })();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Decision failed." }, { status: 400 });
  }
}
