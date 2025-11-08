// src/schemas/userSchemas.ts
import { z } from "zod";

// Schema for creating a new user address
export const createAddressSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Address name (e.g., Home) is required"),
    addressLine1: z.string().min(5, "Address line is required"),
    town: z.string().min(2, "Town is required"),
    county: z.string().min(2, "County is required"),
    isDefault: z.boolean().optional(),
  }),
});

// Schema for updating an existing user address
export const updateAddressSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Address name is required").optional(),
    addressLine1: z.string().min(5, "Address line is required").optional(),
    town: z.string().min(2, "Town is required").optional(),
    county: z.string().min(2, "County is required").optional(),
    isDefault: z.boolean().optional(),
  }),
});

// Schema for updating the user's basic profile (name, phone)
export const updateUserProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    phone: z.string().min(10, "A valid phone number is required").optional(),
  }),
});

// Schema for handling the email change request
export const changeEmailSchema = z.object({
  body: z.object({
    email: z.string().email("A valid email address is required"),
  }),
});