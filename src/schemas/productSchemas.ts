import { z } from "zod";

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(3, { message: "Product name is required" }),
    hsCode: z.string().min(4, { message: "A valid HS Code is required" }),
    basePrice: z.number().positive({ message: "Base price must be a positive number" }),
  }),
});