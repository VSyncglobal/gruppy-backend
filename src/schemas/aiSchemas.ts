// src/schemas/aiSchemas.ts
import { z } from "zod";

export const suggestHSCodeSchema = z.object({
  body: z.object({
    description: z
      .string()
      .min(10, "Description must be at least 10 characters")
      .max(500, "Description must be 500 characters or less"),
  }),
});