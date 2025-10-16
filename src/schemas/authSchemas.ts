import { z } from "zod";

// Zod schema for the registration endpoint
export const registerSchema = z.object({
  body: z.object({
    name: z
      .string()
      // ✅ FIX: Use .min(1) to make the field required and provide a custom message.
      .min(1, { message: "Name is required" })
      .min(2, "Name must be at least 2 characters long"),

    email: z
      .string()
      .min(1, { message: "Email is required" })
      .email("Not a valid email address"),

    password: z
      .string()
      .min(1, { message: "Password is required" })
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        "Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character."
      ),

    role: z.enum(["CONSUMER", "ADMIN", "AFFILIATE"]).optional(),
  }),
});
// ✨ ADD THIS NEW SCHEMA
export const loginSchema = z.object({
  body: z.object({
    email: z.string().min(1, { message: "Email is required" }).email(),
    password: z.string().min(1, { message: "Password is required" }),
  }),
});