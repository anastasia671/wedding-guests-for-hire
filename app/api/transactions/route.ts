import { NextRequest, NextResponse } from "next/server";
import { submitExpense, submitSale } from "@/lib/transactions";
import { expenseInput, saleInput } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.actorId) throw new Error("Choose a demonstration role.");
    const result = body.kind === "sale" ? await submitSale(body.actorId, saleInput.parse(body.data)) : await submitExpense(body.actorId, expenseInput.parse(body.data));
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Submission failed." }, { status: 400 });
  }
}
