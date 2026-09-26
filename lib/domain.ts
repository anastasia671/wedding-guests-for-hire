export type EmployeeRole = "manager" | "salesperson" | "expense_reporter";
export type Project = "A" | "B";
export type Allocation = Project | "overhead";

export type Split = { richard: number; anastasia: number; jeanClaude: number };

export const people = ["Richard Darling", "Anastasia Ferrari", "Jean-Claude Berzins"] as const;

export function money(cents: number) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function cents(value: number) {
  return Math.round(value * 100);
}

export function validateSplit(split: Split) {
  const values = Object.values(split);
  return values.every((value) => Number.isFinite(value) && value >= 0 && value <= 100) &&
    Math.abs(values.reduce((total, value) => total + value, 0) - 100) < 0.001;
}

/** Applies the specification's cents-rounding rule deterministically. */
export function commissionForSale(amountCents: number, split: Split) {
  const poolCents = Math.round(amountCents * 0.1);
  const keys = ["richard", "anastasia", "jeanClaude"] as const;
  const tieOrder = ["richard", "anastasia", "jeanClaude"] as const;
  const earnings = Object.fromEntries(keys.map((key) => [key, Math.round(poolCents * split[key] / 100)])) as Record<typeof keys[number], number>;
  const roundedTotal = Object.values(earnings).reduce((total, value) => total + value, 0);
  const largest = tieOrder.reduce((winner, key) => split[key] > split[winner] ? key : winner, "richard");
  earnings[largest] += poolCents - roundedTotal;
  return { poolCents, earnings };
}

export function projectResult(input: { approvedSalesCents: number; commissionCents: number; expensesCents: number }) {
  return input.approvedSalesCents - input.commissionCents - input.expensesCents;
}
