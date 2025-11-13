// src/schemas/shipmentSchemas.ts
import { z } from "zod";
import { ShipmentStatus } from "@prisma/client";

export const createShipmentSchema = z.object({
  body: z.object({
    name: z.string().min(3, "Shipment name is required"),
    logisticsRouteId: z.string().cuid("Invalid logistics route ID"),
    // --- NEW (v_phase3): Add new fields from schema ---
    trackingNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    departureDate: z.string().datetime("Invalid departure date").optional().nullable(),
    arrivalDate: z.string().datetime("Invalid arrival date").optional().nullable(),
  }),
});

// --- NEW (v_phase3): Renamed this to be specific ---
export const updateShipmentStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(ShipmentStatus, {
      message: "Invalid shipment status",
    }),
  }),
});

// --- NEW (v_phase3): This is the new schema for editing details ---
export const updateShipmentDetailsSchema = z.object({
  body: z.object({
    name: z.string().min(3, "Shipment name is required").optional(),
    logisticsRouteId: z.string().cuid("Invalid logistics route ID").optional(),
    trackingNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    departureDate: z.string().datetime("Invalid departure date").optional().nullable(),
    arrivalDate: z.string().datetime("Invalid arrival date").optional().nullable(),
  }),
});

export const assignPoolToShipmentSchema = z.object({
  body: z.object({
    poolId: z.string().cuid("Invalid pool ID"),
  }),
});