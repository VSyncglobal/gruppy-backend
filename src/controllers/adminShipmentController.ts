// src/controllers/adminShipmentController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node"; // --- CORRECTED SENTRY IMPORT ---
import { PoolStatus, ShipmentStatus } from "@prisma/client";

/**
 * Admin: Create a new (empty) Shipment
 */
export const createShipment = async (req: Request, res: Response) => {
  try {
    const { name, logisticsRouteId } = req.body;

    // Verify the logistics route exists
    const route = await prisma.logisticsRoute.findUniqueOrThrow({
      where: { id: logisticsRouteId },
    });

    const shipment = await prisma.shipment.create({
      data: {
        name,
        logisticsRouteId,
        status: ShipmentStatus.PLANNING,
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
 */
export const addPoolToShipment = async (req: Request, res: Response) => {
  try {
    const { id: shipmentId } = req.params;
    const { poolId } = req.body;

    // Use a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get all required data
      const [shipment, pool, product] = await Promise.all([
        tx.shipment.findUniqueOrThrow({
          where: { id: shipmentId },
          include: { logisticsRoute: true },
        }),
        tx.pool.findUniqueOrThrow({
          where: { id: poolId },
        }),
        tx.product.findUniqueOrThrow({
          where: { id: (await tx.pool.findUniqueOrThrow({where: {id: poolId}})).productId },
        }),
      ]);

      // 2. Check business logic
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

      // 3. Calculate new totals
      const poolVolume = product.volumeCBM * pool.currentQuantity;
      const poolWeight = product.weightKg * pool.currentQuantity;
      const newTotalCBM = shipment.totalCBM + poolVolume;
      const newTotalKg = shipment.totalKg + poolWeight;

      // 4. Check capacity
      if (newTotalCBM > shipment.logisticsRoute.capacityCBM) {
        throw new Error(`Adding this pool exceeds the container's volume capacity. 
          (Current: ${shipment.totalCBM}, 
          Pool: ${poolVolume}, 
          New: ${newTotalCBM}, 
          Capacity: ${shipment.logisticsRoute.capacityCBM})`);
      }
      if (newTotalKg > shipment.logisticsRoute.capacityKg) {
        throw new Error(`Adding this pool exceeds the container's weight capacity. 
          (Current: ${shipment.totalKg}, 
          Pool: ${poolWeight}, 
          New: ${newTotalKg}, 
          Capacity: ${shipment.logisticsRoute.capacityKg})`);
      }

      // 5. Update the Shipment's totals
      const updatedShipment = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          totalCBM: newTotalCBM,
          totalKg: newTotalKg,
        },
      });

      // 6. Update the Pool's shipmentId
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
 */
export const removePoolFromShipment = async (req: Request, res: Response) => {
  try {
    const { id: shipmentId, poolId } = req.params;

    const result = await prisma.$transaction(async (tx) => {
        // 1. Get required data
        const [shipment, pool, product] = await Promise.all([
            tx.shipment.findUniqueOrThrow({
              where: { id: shipmentId },
              include: { logisticsRoute: true },
            }),
            tx.pool.findUniqueOrThrow({
              where: { id: poolId },
            }),
            tx.product.findUniqueOrThrow({
              where: { id: (await tx.pool.findUniqueOrThrow({where: {id: poolId}})).productId },
            }),
          ]);

        // 2. Check business logic
        if (shipment.status !== ShipmentStatus.PLANNING) {
            throw new Error("Cannot remove pools from a shipment that is not in PLANNING status.");
        }
        if (pool.shipmentId !== shipmentId) {
            throw new Error("This pool is not part of this shipment.");
        }

        // 3. Calculate new totals
        const poolVolume = product.volumeCBM * pool.currentQuantity;
        const poolWeight = product.weightKg * pool.currentQuantity;
        const newTotalCBM = shipment.totalCBM - poolVolume;
        const newTotalKg = shipment.totalKg - poolWeight;
        
        // 4. Update the Shipment's totals
        const updatedShipment = await tx.shipment.update({
            where: { id: shipmentId },
            data: {
                totalCBM: newTotalCBM < 0 ? 0 : newTotalCBM,
                totalKg: newTotalKg < 0 ? 0 : newTotalKg,
            },
        });

        // 5. Update the Pool (remove shipmentId)
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
        
        // Logic for setting shipment to IN_TRANSIT
        // This will also update all associated pools to SHIPPING
        if (status === ShipmentStatus.IN_TRANSIT && shipment.status === ShipmentStatus.LOCKED) {
            
            const [updatedShipment] = await prisma.$transaction([
                // 1. Update the shipment
                prisma.shipment.update({
                    where: { id },
                    data: { status }
                }),
                // 2. Update all associated pools to SHIPPING
                prisma.pool.updateMany({
                    where: { shipmentId: id },
                    data: { status: PoolStatus.SHIPPING }
                })
            ]);
            
            logger.info(`Shipment ${id} is now IN_TRANSIT. ${shipment._count.pools} pools updated to SHIPPING.`);
            return res.status(200).json({ success: true, data: updatedShipment });
        }

        // Handle other simple status changes
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