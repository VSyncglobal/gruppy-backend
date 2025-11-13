// src/schemas/adminUserSchemas.ts
import { z } from "zod";
import { UserRole } from "@prisma/client"; // --- NEW (v_phase6): Import enum

export const creditUserBalanceSchema = z.object({
  body: z.object({
    amount: z.coerce.number().positive("Amount must be a positive number"),
    reason: z.string().min(5, "Reason is required"),
  }),
});

// --- NEW (v_phase6): Schema for an admin updating a user's profile ---
export const adminUpdateUserSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid user ID"),
  }),
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    email: z.string().email("Invalid email address").optional(),
    phone: z.string().min(10, "A valid phone number is required").optional().nullable(),
    role: z.nativeEnum(UserRole, {
      message: "Invalid user role"
    }).optional(),
  }),
});