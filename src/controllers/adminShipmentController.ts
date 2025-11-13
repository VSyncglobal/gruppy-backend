// src/controllers/adminShipmentController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";
import { PoolStatus, ShipmentStatus } from "@prisma/client";

/**
 * --- CORRECT (v_phase1) ---
 * Admin: Create a new (empty) Shipment
 * Saves the new tracking and date fields.
 */
export const createShipment = async (req: Request, res: Response) => {
  try {
    // 1. Deconstruct all new fields from req.body
    const {
      name,
      logisticsRouteId,
      trackingNumber,
      notes,
      departureDate,
      arrivalDate,
    } = req.body;

    // 2. Verify the logistics route exists (unchanged)
    const route = await prisma.logisticsRoute.findUniqueOrThrow({
      where: { id: logisticsRouteId },
    });

    // 3. Create the shipment with all new fields
    const shipment = await prisma.shipment.create({
      data: {
        name,
        logisticsRouteId,
        status: ShipmentStatus.PLANNING,
        // --- ADDED NEW FIELDS ---
        trackingNumber: trackingNumber || null,
        notes: notes || null,
        departureDate: departureDate ? new Date(departureDate) : null,
        arrivalDate: arrivalDate ? new Date(arrivalDate) : null,
      },
      include: {
        logisticsRoute: true,
      },
    });

    res.status(201).json({ success: true, data: shipment });
  } catch (error: any) {
    logger.error("Error creating shipment:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Logistics Route not found." });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Get all Shipments
 * (Unchanged)
 */
export const getAllShipments = async (req: Request, res: Response) => {
  try {
    const shipments = await prisma.shipment.findMany({
      include: {
        logisticsRoute: {
          select: { name: true, capacityCBM: true, capacityKg: true },
        },
        _count: {
          select: { pools: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    res.status(200).json({ success: true, data: shipments });
  } catch (error: any) {
    logger.error("Error fetching all shipments:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Get a single Shipment's details, including its pools
 * (Unchanged)
 */
export const getShipmentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const shipment = await prisma.shipment.findUniqueOrThrow({
      where: { id },
      include: {
        logisticsRoute: true,
        pools: {
          include: {
            product: {
              select: { name: true, weightKg: true, volumeCBM: true },
            },
          },
        },
      },
    });
    res.status(200).json({ success: true, data: shipment });
  } catch (error: any) {
    logger.error("Error fetching shipment by ID:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Shipment not found." });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Add a Pool to a Shipment
 * (Unchanged)
 */
export const addPoolToShipment = async (req: Request, res: Response) => {
  try {
    const { id: shipmentId } = req.params;
    const { poolId } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const [shipment, pool, product] = await Promise.all([
        tx.shipment.findUniqueOrThrow({
          where: { id: shipmentId },
          include: { logisticsRoute: true },
        }),
        tx.pool.findUniqueOrThrow({
          where: { id: poolId },
        }),
        tx.product.findUniqueOrThrow({
          where: {
            id: (await tx.pool.findUniqueOrThrow({ where: { id: poolId } }))
              .productId,
          },
        }),
      ]);

      if (shipment.status !== ShipmentStatus.PLANNING) {
        throw new Error(
          "Cannot add pools to a shipment that is not in PLANNING status."
        );
      }
      if (pool.status !== PoolStatus.CLOSED) {
        throw new Error("Only CLOSED pools can be added to a shipment.");
      }
      if (pool.shipmentId === shipmentId) {
        throw new Error("This pool is already in this shipment.");
      }
      if (pool.shipmentId) {
        throw new Error(
          `This pool is already assigned to another shipment (${pool.shipmentId}).`
        );
      }

      const poolVolume = product.volumeCBM * pool.currentQuantity;
      const poolWeight = product.weightKg * pool.currentQuantity;
      const newTotalCBM = shipment.totalCBM + poolVolume;
      const newTotalKg = shipment.totalKg + poolWeight;

      if (newTotalCBM > shipment.logisticsRoute.capacityCBM) {
        throw new Error(
          `Adding this pool exceeds the container's volume capacity.`
        );
      }
      if (newTotalKg > shipment.logisticsRoute.capacityKg) {
        throw new Error(
          `Adding this pool exceeds the container's weight capacity.`
        );
      }

      const updatedShipment = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          totalCBM: newTotalCBM,
          totalKg: newTotalKg,
        },
      });

      await tx.pool.update({
        where: { id: poolId },
        data: {
          shipmentId: shipmentId,
        },
      });

      return updatedShipment;
    });

    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    logger.error("Error adding pool to shipment:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Shipment or Pool not found." });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Remove a Pool from a Shipment
 * (Unchanged)
 */
export const removePoolFromShipment = async (req: Request, res: Response) => {
  try {
    const { id: shipmentId, poolId } = req.params;

    const result = await prisma.$transaction(async (tx) => {
      const [shipment, pool, product] = await Promise.all([
        tx.shipment.findUniqueOrThrow({
          where: { id: shipmentId },
          include: { logisticsRoute: true },
        }),
        tx.pool.findUniqueOrThrow({
          where: { id: poolId },
        }),
        tx.product.findUniqueOrThrow({
          where: {
            id: (await tx.pool.findUniqueOrThrow({ where: { id: poolId } }))
              .productId,
          },
        }),
      ]);

      if (shipment.status !== ShipmentStatus.PLANNING) {
        throw new Error(
          "Cannot remove pools from a shipment that is not in PLANNING status."
        );
      }
      if (pool.shipmentId !== shipmentId) {
        throw new Error("This pool is not part of this shipment.");
      }

      const poolVolume = product.volumeCBM * pool.currentQuantity;
      const poolWeight = product.weightKg * pool.currentQuantity;
      const newTotalCBM = shipment.totalCBM - poolVolume;
      const newTotalKg = shipment.totalKg - poolWeight;

      const updatedShipment = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          totalCBM: newTotalCBM < 0 ? 0 : newTotalCBM,
          totalKg: newTotalKg < 0 ? 0 : newTotalKg,
        },
      });

      await tx.pool.update({
        where: { id: poolId },
        data: {
          shipmentId: null,
        },
      });

      return updatedShipment;
    });

    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    logger.error("Error removing pool from shipment:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Shipment or Pool not found." });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Update a Shipment's status (e.g., PLANNING -> LOCKED -> IN_TRANSIT)
 * (Unchanged)
 */
export const updateShipmentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: ShipmentStatus };

    const shipment = await prisma.shipment.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { pools: true } } },
    });

    if (
      status === ShipmentStatus.LOCKED &&
      shipment.status === ShipmentStatus.PLANNING
    ) {
      if (shipment._count.pools === 0) {
        throw new Error("Cannot lock an empty shipment. Add pools first.");
      }
    }

    if (
      status === ShipmentStatus.IN_TRANSIT &&
      shipment.status === ShipmentStatus.LOCKED
    ) {
      const [updatedShipment] = await prisma.$transaction([
        prisma.shipment.update({
          where: { id },
          data: { status },
        }),
        prisma.pool.updateMany({
          where: { shipmentId: id },
          data: { status: PoolStatus.SHIPPING },
        }),
      ]);

      logger.info(
        `Shipment ${id} is now IN_TRANSIT. ${shipment._count.pools} pools updated to SHIPPING.`
      );
      return res.status(200).json({ success: true, data: updatedShipment });
    }

    const updatedShipment = await prisma.shipment.update({
      where: { id },
      data: { status },
    });

    res.status(200).json({ success: true, data: updatedShipment });
  } catch (error: any) {
    logger.error("Error updating shipment status:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Shipment not found." });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * --- MODIFIED (v_phase3) ---
 * Admin: Update a Shipment's details
 * Now saves all fields from the schema.
 */
export const updateShipment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // 1. Deconstruct all fields from the body
    const {
      name,
      logisticsRouteId,
      trackingNumber,
      notes,
      departureDate,
      arrivalDate,
    } = req.body;

    const shipment = await prisma.shipment.findUniqueOrThrow({
      where: { id },
    });

    // 2. Only allow editing if in PLANNING (Unchanged)
    if (shipment.status !== ShipmentStatus.PLANNING) {
      return res.status(400).json({
        success: false,
        message: "Can only edit shipments that are in PLANNING status.",
      });
    }

    // 3. Update the shipment with all new fields
    const updatedShipment = await prisma.shipment.update({
      where: { id },
      data: {
        name,
        logisticsRouteId,
        trackingNumber: trackingNumber || null,
        notes: notes || null,
        departureDate: departureDate ? new Date(departureDate) : null,
        arrivalDate: arrivalDate ? new Date(arrivalDate) : null,
      },
    });

    res.status(200).json({ success: true, data: updatedShipment });
  } catch (error: any) {
    logger.error("Error updating shipment:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Shipment or Route not found." });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * --- CORRECT (v_phase3) ---
 * Admin: Delete a Shipment
 */
export const deleteShipment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 1. Unlink all pools from this shipment in a transaction
    //    We must do this before deleting the shipment.
    await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUniqueOrThrow({
        where: { id },
        include: {
          _count: {
            select: { pools: true },
          },
        },
      });

      // 2. Check status (moved inside transaction)
      if (shipment.status !== ShipmentStatus.PLANNING) {
        throw new Error(
          "Cannot delete a shipment that is not in PLANNING status."
        );
      }
      
      // 3. Unlink all pools
      if (shipment._count.pools > 0) {
        await tx.pool.updateMany({
          where: { shipmentId: id },
          data: { shipmentId: null },
        });
      }

      // 4. Now, safely delete the shipment
      await tx.shipment.delete({
        where: { id },
      });
    });

    res.status(204).send(); // 204 No Content
  } catch (error: any) {
    logger.error("Error deleting shipment:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Shipment not found." });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};