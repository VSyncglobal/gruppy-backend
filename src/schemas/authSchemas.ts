// src/schemas/authSchemas.ts
import { z } from "zod";

// Zod schema for the registration endpoint
export const registerSchema = z.object({
  body: z.object({
    name: z
      .string()
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

export const loginSchema = z.object({
  body: z.object({
    email: z.string().min(1, { message: "Email is required" }).email(),
    password: z.string().min(1, { message: "Password is required" }),
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    email: z.string().email("Invalid email address").optional(),
  }),
});

// --- ✅ NEW SCHEMAS FOR PHASE 1 ---

export const emailVerificationSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Verification token is required"),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("A valid email is required"),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: z.string().regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        "Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character."
      ),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        "New password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character."
      ),
  }),
});

export const updatePhoneSchema = z.object({
  body: z.object({
    phone: z.string().min(10, "A valid phone number is required"),
  }),
});

export const updateAddressSchema = z.object({
  body: z.object({
    address: z.string().min(5, "Address is required").optional(),
    location: z.string().min(3, "Location is required").optional(),
  }),
});