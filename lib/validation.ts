import { z } from "zod";

const positiveMoney = z.number().finite().positive();
const split = z.object({ richard: z.number().min(0).max(100), anastasia: z.number().min(0).max(100), jeanClaude: z.number().min(0).max(100) })
  .refine((value) => Math.abs(value.richard + value.anastasia + value.jeanClaude - 100) < 0.001, "Commission shares must total 100%.");

export const saleInput = z.object({
  reference: z.string().regex(/^S\d+$/, "Use a sales reference such as S01."),
  customer: z.string().trim().min(1), project: z.enum(["A", "B"]), description: z.string().trim().min(1), amount: positiveMoney, split
});

export const expenseInput = z.object({
  reference: z.string().regex(/^E\d+$/, "Use an expense reference such as E01."),
  description: z.string().trim().min(1), category: z.enum(["Materials", "Travel", "Other"]), amount: positiveMoney, proposedAllocation: z.enum(["A", "B", "overhead"])
});
