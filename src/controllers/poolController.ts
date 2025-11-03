// src/controllers/poolController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";
import { PoolStatus, PaymentStatus, GlobalSetting } from "@prisma/client";
import { updatePoolFinance } from "../hooks/poolFinanceHooks";

const getSettings = (settings: GlobalSetting[]) => {
  const settingsMap = new Map(settings.map((s) => [s.key, parseFloat(s.value)]));
  return {
    CONTINGENCY_FEE_RATE: settingsMap.get("CONTINGENCY_FEE_RATE") || 0.02,
  };
};

// Get all pools (public)
export const getAllPools = async (req: Request, res: Response) => {
  try {
    const pools = await prisma.pool.findMany({
      where: {
        status: {
          in: [PoolStatus.FILLING],
        },
        deadline: {
          gt: new Date(),
        },
      },
      include: {
        product: true,
        finance: true,
      },
      orderBy: {
        deadline: "asc",
      },
    });
    res.status(200).json({ success: true, data: pools });
  } catch (error: any) {
    logger.error("Error fetching all pools:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all pools (admin)
export const getAllPoolsAdmin = async (req: Request, res: Response) => {
  try {
    const pools = await prisma.pool.findMany({
      include: {
        product: true,
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        finance: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    res.status(200).json({ success: true, data: pools });
  } catch (error: any) {
    logger.error("Error fetching admin pools:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single pool (public/user)
export const getPoolById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = await prisma.pool.findUnique({
      where: { id },
      include: {
        product: true,
        finance: true,
        members: {
          select: {
            userId: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    if (!pool) {
      return res.status(404).json({ success: false, message: "Pool not found" });
    }
    res.status(200).json({ success: true, data: pool });
  } catch (error: any) {
    logger.error("Error fetching pool by id:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// User joins a pool
export const joinPool = async (req: Request, res: Response) => {
  const { id: poolId } = req.params;
  const { quantity, method } = req.body;
  const userId = (req as any).user.id;

  try {
    const { payment, pool } = await prisma.$transaction(async (tx) => {
      // 1. Get the pool and check rules
      const pool = await tx.pool.findUniqueOrThrow({
        where: { id: poolId },
      });

      if (pool.status !== PoolStatus.FILLING) {
        throw new Error("This pool is not open for joining.");
      }
      if (pool.deadline < new Date()) {
        throw new Error("This pool's deadline has passed.");
      }

      // 2. Check for existing UNPAID memberships
      const existingPendingMember = await tx.poolMember.findFirst({
        where: {
          userId: userId,
          poolId: poolId,
          payment: {
            status: PaymentStatus.PENDING,
          },
        },
        include: { payment: true },
      });

      if (existingPendingMember && existingPendingMember.payment) {
        logger.warn(`User ${userId} attempting to re-join pool ${poolId} with a pending payment. Returning existing payment ${existingPendingMember.paymentId}.`);
        return { payment: existingPendingMember.payment, pool };
      }

      // 3. Check if they are already a SUCCESSFUL member
      const existingSuccessMember = await tx.poolMember.findFirst({
        where: {
          userId: userId,
          poolId: poolId,
          payment: {
            status: PaymentStatus.SUCCESS,
          },
        },
      });
      if (existingSuccessMember) {
        throw new Error("You are already a confirmed member of this pool.");
      }

      // 4. Calculate new quantity and check if pool will close
      const newQuantity = pool.currentQuantity + quantity;
      let newStatus: PoolStatus = pool.status;
      if (newQuantity >= pool.targetQuantity) {
        newStatus = PoolStatus.CLOSED;
      }
      const progress = (newQuantity / pool.targetQuantity) * 100;
      const cumulativeValue = newQuantity * pool.pricePerUnit;

      // 5. Create the PENDING Payment record
      const payment = await tx.payment.create({
        data: {
          amount: pool.pricePerUnit * quantity,
          status: PaymentStatus.PENDING,
          method: method,
        },
      });

      // 6. Create the PoolMember and link it to the Payment
      await tx.poolMember.create({
        data: {
          poolId,
          userId,
          quantity,
          paymentId: payment.id,
        },
      });

      // 7. Update the pool's quantity, status, and progress
      const updatedPool = await tx.pool.update({
        where: { id: poolId },
        data: {
          currentQuantity: newQuantity,
          status: newStatus,
          progress: progress,
          cumulativeValue: cumulativeValue,
        },
      });

      // 8. Call the finance hook
      await updatePoolFinance(tx, poolId);

      return { payment, pool: updatedPool };
    });

    if (pool.status === PoolStatus.CLOSED) {
      logger.info(`Pool ${poolId} has been filled by user ${userId} and is now CLOSED.`);
    }

    res.status(201).json({
      success: true,
      message: "Pool joined. Please complete your payment.",
      data: {
        paymentId: payment.id,
        amount: payment.amount,
        status: payment.status,
      },
    });

  } catch (error: any) { 
    logger.error(`Error joining pool ${poolId} for user ${userId}:`, error);
    Sentry.captureException(error, {
      extra: { poolId, userId, quantity, method },
    });
    res.status(400).json({ success: false, message: error.message || "Could not join pool." });
  }
};


// Admin: Create a new pool
export const createPool = async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      imageUrls,
      productId,
      pricePerUnit,
      targetQuantity,
      minJoiners,
      deadline,
      baseCostPerUnit, 
      logisticsRouteId,
    } = req.body;

    const createdPool = await prisma.$transaction(async (tx) => {
      // 1. Fetch all necessary data
      const [product, logisticsRoute, kraRate, globalSettings] = await Promise.all([
        tx.product.findUniqueOrThrow({
          where: { id: productId },
        }),
        tx.logisticsRoute.findUniqueOrThrow({
          where: { id: logisticsRouteId },
        }),
        (async () => {
          const prod = await tx.product.findUniqueOrThrow({ where: { id: productId } });
          return tx.kRARate.findFirstOrThrow({
            where: { hsCode: { startsWith: prod.hsCode } },
            orderBy: { effectiveFrom: "desc" },
          });
        })(),
        tx.globalSetting.findMany({
          where: { key: { in: ["CONTINGENCY_FEE_RATE"] } },
        }),
      ]);

      const settings = getSettings(globalSettings);

      // 2. Calculate Total Fixed Costs (with contingency)
      const totalFixedCosts =
        (logisticsRoute.seaFreightCost +
        logisticsRoute.originCharges +
        logisticsRoute.portChargesMombasa +
        logisticsRoute.clearingAgentFee +
        logisticsRoute.inlandTransportCost -
        logisticsRoute.containerDeposit) * (1 + settings.CONTINGENCY_FEE_RATE);

      // 3. Calculate Total Variable Cost Per Unit (with contingency)
      const cost = baseCostPerUnit; 
      const insurance = cost * logisticsRoute.marineInsuranceRate;
      const cif_per_unit = cost + insurance;

      const importDuty = cif_per_unit * kraRate.duty_rate;
      const idf = cif_per_unit * kraRate.idf_rate;
      const rdl = cif_per_unit * kraRate.rdl_rate;
      const vatBase = cif_per_unit + importDuty + idf + rdl;
      const vat = vatBase * kraRate.vat_rate;
      const taxes_per_unit = importDuty + idf + rdl + vat;
      
      const totalVariableCostPerUnit = (baseCostPerUnit + taxes_per_unit + insurance) * (1 + settings.CONTINGENCY_FEE_RATE);

      // 4. Create the Pool
      const pool = await tx.pool.create({
        data: {
          title,
          description,
          imageUrls: imageUrls || [],
          productId,
          pricePerUnit: parseFloat(pricePerUnit),
          targetQuantity: parseInt(targetQuantity, 10),
          minJoiners: parseInt(minJoiners, 10),
          deadline: new Date(deadline),
          createdById: (req as any).user.id,
          status: PoolStatus.FILLING, 
        },
      });

      // 5. Create the associated PoolFinance record
      await tx.poolFinance.create({
        data: {
          poolId: pool.id,
          baseCostPerUnit: parseFloat(baseCostPerUnit),
          benchmarkPricePerUnit: product.benchmarkPrice, 
          totalFixedCosts: totalFixedCosts,
          totalVariableCostPerUnit: totalVariableCostPerUnit,
        },
      });
      
      return pool;
    });

    res.status(201).json({ success: true, data: createdPool });
  } catch (error: any) {
    logger.error("Error creating pool:", error);
    Sentry.captureException(error);
    if (error.name === 'NotFoundError' || error.code === 'P2025') {
       return res
        .status(404)
        .json({ success: false, message: "Could not find Product, Logistics Route, or KRA Rate." });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Update a pool
export const updatePool = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      imageUrls,
      pricePerUnit, 
      targetQuantity,
      minJoiners,
      deadline,
    } = req.body;

    const pool = await prisma.pool.update({
      where: { id },
      data: {
        title,
        description,
        imageUrls,
        pricePerUnit: pricePerUnit ? parseFloat(pricePerUnit) : undefined,
        targetQuantity: targetQuantity ? parseInt(targetQuantity, 10) : undefined,
        minJoiners: minJoiners ? parseInt(minJoiners, 10) : undefined,
        deadline: deadline ? new Date(deadline) : undefined,
      },
    });

    res.status(200).json({ success: true, data: pool });
  } catch (error: any) {
    logger.error("Error updating pool:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, message: "Pool or Product not found" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Delete a pool
export const deletePool = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.$transaction(async (tx) => {
      // 1. Delete associated Reviews
      await tx.review.deleteMany({ where: { poolId: id }});

      // 2. Find all PoolMembers
      const membersToDelete = await tx.poolMember.findMany({ where: { poolId: id }});
      const paymentIdsToDelete = membersToDelete
        .map(m => m.paymentId)
        .filter(pid => pid !== null) as string[];

      // 3. Delete associated Payments
      if (paymentIdsToDelete.length > 0) {
        await tx.payment.deleteMany({ where: { id: { in: paymentIdsToDelete } } });
      }

      // 4. Delete PoolMembers
      await tx.poolMember.deleteMany({ where: { poolId: id } });

      // 5. Delete PoolFinance
      await tx.poolFinance.delete({ where: { poolId: id } });
      
      // 6. Finally, delete the Pool
      await tx.pool.delete({
        where: { id },
      });
    });

    res.status(204).send();
  } catch (error: any) {
    logger.error("Error deleting pool:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, message: "Pool not found" });
    }
    // --- THIS IS THE FIX ---
    // Replaced 4KON with 409
    if (error.code === "P2003" || error.code === "P2014") {
      return res.status(409).json({
        success: false,
        message: "Cannot delete pool, check foreign key constraints (e.g., reviews, orders).",
      });
    }
    // --- END OF FIX ---
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Manually update pool status
export const adminUpdatePoolStatus = async (req: Request, res: Response) => {
   try {
    const { id } = req.params;
    const { status } = req.body;

    const updatedPool = await prisma.pool.update({
      where: { id },
      data: {
        status: status as PoolStatus,
      },
    });
    
    if (status === PoolStatus.SHIPPING) {
      logger.info(`Pool ${id} is now SHIPPING.`);
    } else if (status === PoolStatus.DELIVERED) {
      // TODO: Logic for when pool is delivered
    }

    res.status(200).json({ success: true, data: updatedPool });
  } catch (error: any) {
    logger.error("Error updating pool status:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, message: "Pool not found" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};