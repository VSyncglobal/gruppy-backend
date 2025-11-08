// src/schemas/shipmentSchemas.ts
import { z } from "zod";
import { ShipmentStatus } from "@prisma/client";

export const createShipmentSchema = z.object({
  body: z.object({
    name: z.string().min(3, "Shipment name is required"),
    logisticsRouteId: z
      .string()
      .cuid("Invalid logistics route ID"),
  }),
});

export const updateShipmentStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(ShipmentStatus, {
      // --- THIS IS THE FIX ---
      // Replaced 'errorMap' with the 'message' property
      message: "Invalid shipment status",
      // --- END OF FIX ---
    }),
  }),
});

export const assignPoolToShipmentSchema = z.object({
  body: z.object({
    poolId: z.string().cuid("Invalid pool ID"),
  }),
});