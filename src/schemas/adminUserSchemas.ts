// src/schemas/adminUserSchemas.ts
import { z } from "zod";

export const creditUserBalanceSchema = z.object({
  body: z.object({
    amount: z.coerce.number().positive("Amount must be a positive number"),
    reason: z.string().min(5, "Reason is required"),
  }),
});