// src/controllers/adminShipmentController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";
import { PoolStatus, ShipmentStatus } from "@prisma/client";
import { updatePoolFinance } from "../hooks/poolFinanceHooks"; // We need this for the new BulkOrder logic

/**
 * Admin: Create a new (empty) Shipment
 * (Unchanged)
 */
export const createShipment = async (req: Request, res: Response) => {
  try {
    const {
      name,
      logisticsRouteId,
      trackingNumber,
      notes,
      departureDate,
      arrivalDate,
    } = req.body;

    const route = await prisma.logisticsRoute.findUniqueOrThrow({
      where: { id: logisticsRouteId },
    });

    const shipment = await prisma.shipment.create({
      data: {
        name,
        logisticsRouteId,
        status: ShipmentStatus.PLANNING,
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
            finance: true, // Also include finance for a complete picture
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
      const pool = await tx.pool.findUniqueOrThrow({
        where: { id: poolId },
        include: { product: true } // Include product for CBM/Kg
      });
      const shipment = await tx.shipment.findUniqueOrThrow({
        where: { id: shipmentId },
        include: { logisticsRoute: true },
      });

      if (shipment.status !== ShipmentStatus.PLANNING) {
        throw new Error("Cannot add pools to a shipment that is not in PLANNING status.");
      }
      if (pool.status !== PoolStatus.CLOSED) {
        throw new Error("Only CLOSED pools can be added to a shipment.");
      }
      if (pool.shipmentId === shipmentId) {
        throw new Error("This pool is already in this shipment.");
      }
      if (pool.shipmentId) {
        throw new Error(`This pool is already assigned to another shipment (${pool.shipmentId}).`);
      }

      const poolVolume = pool.product.volumeCBM * pool.currentQuantity;
      const poolWeight = pool.product.weightKg * pool.currentQuantity;
      const newTotalCBM = shipment.totalCBM + poolVolume;
      const newTotalKg = shipment.totalKg + poolWeight;

      if (newTotalCBM > shipment.logisticsRoute.capacityCBM) {
        throw new Error(`Adding this pool exceeds the container's volume capacity.`);
      }
      if (newTotalKg > shipment.logisticsRoute.capacityKg) {
        throw new Error(`Adding this pool exceeds the container's weight capacity.`);
      }

      const updatedShipment = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          totalCBM: newTotalCBM,
          totalKg: newTotalKg,
          pools: {
            connect: { id: poolId } // Connect the pool
          }
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
 * --- MODIFIED (Fix 6): Added logging for negative calculation ---
 */
export const removePoolFromShipment = async (req: Request, res: Response) => {
  try {
    const { id: shipmentId, poolId } = req.params;

    const result = await prisma.$transaction(async (tx) => {
        const pool = await tx.pool.findUniqueOrThrow({
            where: { id: poolId },
            include: { product: true }
        });
        const shipment = await tx.shipment.findUniqueOrThrow({
            where: { id: shipmentId },
        });

        if (shipment.status !== ShipmentStatus.PLANNING) {
            throw new Error("Cannot remove pools from a shipment that is not in PLANNING status.");
        }
        if (pool.shipmentId !== shipmentId) {
            throw new Error("This pool is not part of this shipment.");
        }

        const poolVolume = pool.product.volumeCBM * pool.currentQuantity;
        const poolWeight = pool.product.weightKg * pool.currentQuantity;
        
        let newTotalCBM = shipment.totalCBM - poolVolume;
        let newTotalKg = shipment.totalKg - poolWeight;
        
        // --- NEW (Fix 6): Logging enhancement ---
        if (newTotalCBM < 0 || newTotalKg < 0) {
          logger.warn(`Shipment ${shipmentId} calculation resulted in negative CBM/Kg after removing pool ${poolId}. Resetting to 0.`);
          if (newTotalCBM < 0) newTotalCBM = 0;
          if (newTotalKg < 0) newTotalKg = 0;
        }
        // --- END (Fix 6) ---
        
        const updatedShipment = await tx.shipment.update({
            where: { id: shipmentId },
            data: {
                totalCBM: newTotalCBM,
                totalKg: newTotalKg,
                pools: {
                  disconnect: { id: poolId } // Disconnect the pool
                }
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
            include: { _count: { select: { pools: true }} }
        });

        // Logic for locking a shipment
        if (status === ShipmentStatus.LOCKED && shipment.status === ShipmentStatus.PLANNING) {
            if (shipment._count.pools === 0) {
                throw new Error("Cannot lock an empty shipment. Add pools first.");
            }
        }
        
        // Logic for setting a shipment to transit
        if (status === ShipmentStatus.IN_TRANSIT && shipment.status !== ShipmentStatus.LOCKED) {
             throw new Error("Shipment must be LOCKED before it can be set to IN_TRANSIT.");
        }

        // --- Transaction for IN_TRANSIT status change ---
        if (status === ShipmentStatus.IN_TRANSIT && shipment.status === ShipmentStatus.LOCKED) {
            
            const [updatedShipment] = await prisma.$transaction([
                prisma.shipment.update({
                    where: { id },
                    data: { status }
                }),
                // Update all associated pools to SHIPPING
                prisma.pool.updateMany({
                    where: { shipmentId: id },
                    data: { status: PoolStatus.SHIPPING }
                })
            ]);
            
            logger.info(`Shipment ${id} is now IN_TRANSIT. ${shipment._count.pools} pools updated to SHIPPING.`);
            return res.status(200).json({ success: true, data: updatedShipment });
        }

        // --- Default status update for other statuses ---
        const updatedShipment = await prisma.shipment.update({
            where: { id },
            data: { status }
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
 * Admin: Update a Shipment's details (e.g., name, route, tracking)
 * (Unchanged)
 */
export const updateShipment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
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

    if (shipment.status !== ShipmentStatus.PLANNING) {
      return res.status(400).json({
        success: false,
        message: "Can only edit shipments that are in PLANNING status.",
      });
    }

    const updatedShipment = await prisma.shipment.update({
      where: { id },
      data: {
        name,
        logisticsRouteId,
        trackingNumber,
        notes,
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
 * Admin: Delete a Shipment
 * (Unchanged)
 */
export const deleteShipment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUniqueOrThrow({
        where: { id },
        include: {
          _count: {
            select: { pools: true },
          },
        },
      });

      if (shipment.status !== ShipmentStatus.PLANNING) {
        throw new Error(
          "Cannot delete a shipment that is not in PLANNING status."
        );
      }

      // Unlink all pools before deleting
      if (shipment._count.pools > 0) {
        await tx.pool.updateMany({
          where: { shipmentId: id },
          data: { shipmentId: null },
        });
      }

      await tx.shipment.delete({
        where: { id },
      });
    });

    res.status(204).send();
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