import { z } from "zod";

export const createPoolSchema = z.object({
  body: z.object({
    title: z.string().min(3, { message: "Title must be at least 3 characters long" }),
    productId: z.string().cuid({ message: "A valid productId is required" }),
    pricePerUnit: z.number().positive({ message: "pricePerUnit must be a positive number" }),
    targetQuantity: z.number().int().positive({ message: "targetQuantity must be a positive integer" }),
    deadline: z.string().datetime({ message: "Deadline must be a valid ISO date string" }),
    createdById: z.string().cuid({ message: "A valid createdById is required" }),
    description: z.string().optional(),
  }),
});

export const joinPoolSchema = z.object({
    body: z.object({
        poolId: z.string().cuid({ message: "A valid poolId is required" }),
        quantity: z.number().int().positive().optional(),
    })
});