import { NextResponse } from "next/server";
import { commissionForSale, projectResult } from "@/lib/domain";
import { adminDb } from "@/lib/supabase";

export async function GET() {
  try {
    const db = adminDb();
    const [{ data: sales, error: salesError }, { data: expenses, error: expensesError }, { data: employees, error: employeesError }] = await Promise.all([
      db.from("sales").select("*, submitter:employees!submitted_by(name) ").order("submitted_at", { ascending: false }),
      db.from("expenses").select("*, submitter:employees!submitted_by(name)").order("submitted_at", { ascending: false }),
      db.from("employees").select("id,name,role,telegram_user_id,telegram_chat_id").order("name")
    ]);
    if (salesError || expensesError || employeesError) throw new Error(salesError?.message || expensesError?.message || employeesError?.message);
    const projects = { A: { income: 0, commission: 0, expenses: 0, result: 0 }, B: { income: 0, commission: 0, expenses: 0, result: 0 } };
    const commissions = { "Richard Darling": 0, "Anastasia Ferrari": 0, "Jean-Claude Berzins": 0 } as Record<string, number>;
    let overhead = 0, awaiting = 0, companyIncome = 0, companyCommission = 0, companyExpenses = 0;
    for (const sale of sales ?? []) if (sale.status === "approved") {
      const calculation = commissionForSale(sale.amount_cents, { richard: Number(sale.approved_richard), anastasia: Number(sale.approved_anastasia), jeanClaude: Number(sale.approved_jean_claude) });
      projects[sale.project as "A" | "B"].income += sale.amount_cents; projects[sale.project as "A" | "B"].commission += calculation.poolCents; companyIncome += sale.amount_cents; companyCommission += calculation.poolCents;
      commissions["Richard Darling"] += calculation.earnings.richard; commissions["Anastasia Ferrari"] += calculation.earnings.anastasia; commissions["Jean-Claude Berzins"] += calculation.earnings.jeanClaude;
    }
    for (const expense of expenses ?? []) { companyExpenses += expense.amount_cents; if (expense.status === "awaiting_allocation") awaiting += expense.amount_cents; else if (expense.final_allocation === "overhead") overhead += expense.amount_cents; else projects[expense.final_allocation as "A" | "B"].expenses += expense.amount_cents; }
    for (const project of Object.values(projects)) project.result = projectResult({ approvedSalesCents: project.income, commissionCents: project.commission, expensesCents: project.expenses });
    return NextResponse.json({ employees, sales, expenses, projects, overhead, awaiting, commissions, company: { income: companyIncome, commission: companyCommission, expenses: companyExpenses, result: companyIncome - companyCommission - companyExpenses } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load overview." }, { status: 500 }); }
}
