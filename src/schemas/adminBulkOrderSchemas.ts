// src/schemas/adminBulkOrderSchemas.ts
import { z } from "zod";
import { BulkOrderStatus } from "@prisma/client";

export const updateBulkOrderSchema = z.object({
  body: z.object({
    status: z.nativeEnum(BulkOrderStatus).optional(),
    totalOrderCostKES: z.coerce.number().positive().optional(),
    totalLogisticsCostKES: z.coerce.number().positive().optional(),
    totalTaxesKES: z.coerce.number().nonnegative().optional(),
    costPerItemUSD: z.coerce.number().positive().optional(),
    exchangeRate: z.coerce.number().positive().optional(),
  }),
});