// src/controllers/poolController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";
import { PoolStatus, PaymentStatus, GlobalSetting, Prisma } from "@prisma/client";
import { updatePoolFinance } from "../hooks/poolFinanceHooks";

const getSettings = (settings: GlobalSetting[]) => {
  const settingsMap = new Map(settings.map((s) => [s.key, parseFloat(s.value)]));
  return {
    CONTINGENCY_FEE_RATE: settingsMap.get("CONTINGENCY_FEE_RATE") || 0.02,
  };
};

/**
 * --- MODIFIED (v1.3): Get all pools (public) with Filtering & Search ---
 */
export const getAllPools = async (req: Request, res: Response) => {
  try {
    const { search, category, sort } = req.query;

    let where: Prisma.PoolWhereInput = {
      status: { in: [PoolStatus.FILLING] },
      deadline: { gt: new Date() },
    };

    if (search && typeof search === 'string') {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (category && typeof category === 'string') {
      if (typeof where.product !== 'object' || where.product === null) {
        where.product = {};
      }
      where.product.category = {
        name: { equals: category, mode: 'insensitive' },
      };
    }

    let orderBy: Prisma.PoolOrderByWithRelationInput = { deadline: 'asc' };
    if (sort === 'newest') {
      orderBy = { createdAt: 'desc' };
    } else if (sort === 'price_asc') {
      orderBy = { pricePerUnit: 'asc' };
    } else if (sort === 'price_desc') {
      orderBy = { pricePerUnit: 'desc' };
    }

    const pools = await prisma.pool.findMany({
      where,
      include: {
        product: true,
        finance: true,
      },
      orderBy,
    });
    res.status(200).json({ success: true, data: pools });
  } catch (error: any) {
    logger.error("Error fetching all pools:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all pools (admin) - Unchanged
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

/**
 * --- MODIFIED (v1.3): Get single pool (public/user) with Anonymized Members ---
 */
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

    const anonymizedMembers = pool.members.map(member => {
      const firstName = member.user.name.split(' ')[0];
      const lastNameInitial = member.user.name.split(' ')[1]?.[0] || '';
      return {
        name: `${firstName} ${lastNameInitial}${lastNameInitial ? '.' : ''}`
      };
    });
    
    const { members, ...poolData } = pool;

    res.status(200).json({ 
      success: true, 
      data: {
        ...poolData,
        members: anonymizedMembers,
      } 
    });
  } catch (error: any) {
    logger.error("Error fetching pool by id:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// src/controllers/poolController.ts
// ... (keep other functions: getSettings, getAllPools, etc.) ...
// src/controllers/poolController.ts
// ... (keep other functions: getSettings, getAllPools, etc.) ...

// --- MODIFIED (v1.3): Implements Account Balance Deduction ---
export const joinPool = async (req: Request, res: Response) => {
  const { id: poolId } = req.params;
  const { quantity, method, deliveryFee } = req.body;
  const userId = (req as any).user.id;

  let paymentStatus: PaymentStatus = PaymentStatus.PENDING;
  
  // --- THIS IS THE FIX ---
  // We must initialize 'message' with a default value.
  let message: string = "Pool join processed.";
  // --- END FIX ---

  try {
    const { payment, pool } = await prisma.$transaction(async (tx) => {
      // 1. Get pool, product, and user data
      const pool = await tx.pool.findUniqueOrThrow({
        where: { id: poolId },
      });
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
      });

      // 2. Check pool rules
      if (pool.status !== PoolStatus.FILLING) {
        throw new Error("This pool is not open for joining.");
      }
      if (pool.deadline < new Date()) {
        throw new Error("This pool's deadline has passed.");
      }
      
      // 3. Check for existing SUCCESSFUL memberships (unchanged)
      const existingSuccessMember = await tx.poolMember.findFirst({
        where: { userId: userId, poolId: poolId, payment: { status: PaymentStatus.SUCCESS } },
      });
      if (existingSuccessMember) {
        throw new Error("You are already a confirmed member of this pool.");
      }

      // 4. --- NEW BALANCE LOGIC ---
      const totalItemCost = pool.pricePerUnit * quantity;
      const totalCost = totalItemCost + (deliveryFee || 0); // Use deliveryFee

      const amountToDeduct = Math.min(user.accountBalance, totalCost);
      const remainingToPay = totalCost - amountToDeduct;

      if (amountToDeduct > 0) {
        await tx.user.update({
          where: { id: userId },
          data: { accountBalance: { decrement: amountToDeduct } },
        });
        logger.info(`Deducted ${amountToDeduct} from user ${userId} balance.`);
      }
      
      // If balance covered everything, mark as SUCCESS
      if (remainingToPay <= 0) {
        paymentStatus = PaymentStatus.SUCCESS;
        message = "Pool joined successfully! Your account balance covered the full cost.";
        logger.info(`User ${userId} joined pool ${poolId} fully with account balance.`);
      } else {
        paymentStatus = PaymentStatus.PENDING;
        // Also improve the message
        message = `Pool joined. ${amountToDeduct > 0 ? `Used ${amountToDeduct} from balance. ` : ''}Please complete the remaining payment of ${remainingToPay}.`;
      }
      // --- END NEW BALANCE LOGIC ---

      // 5. Create the Payment record
      const payment = await tx.payment.create({
        data: {
          amount: remainingToPay, // Pay the remainder
          status: paymentStatus, // Can be PENDING or SUCCESS
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

      // 7. Update the pool's quantity (ONLY if payment was successful)
      let newQuantity = pool.currentQuantity;
      let newStatus: PoolStatus = pool.status;
      let progress = pool.progress;
      let cumulativeValue = pool.cumulativeValue;
      
      if (paymentStatus === PaymentStatus.SUCCESS) {
        newQuantity = pool.currentQuantity + quantity;
        if (newQuantity >= pool.targetQuantity) {
          newStatus = PoolStatus.CLOSED;
        }
        progress = (newQuantity / pool.targetQuantity) * 100;
        cumulativeValue = newQuantity * pool.pricePerUnit;
      }
      
      const updatedPool = await tx.pool.update({
        where: { id: poolId },
        data: {
          currentQuantity: newQuantity,
          status: newStatus,
          progress: progress,
          cumulativeValue: cumulativeValue,
        },
      });

      // 8. Call the finance hook (only if successful)
      if (paymentStatus === PaymentStatus.SUCCESS) {
        await updatePoolFinance(tx, poolId);
      }

      return { payment, pool: updatedPool };
    });

    if (pool.status === PoolStatus.CLOSED) {
      logger.info(`Pool ${poolId} has been filled by user ${userId} and is now CLOSED.`);
    }

    res.status(201).json({
      success: true,
      message: message, // Use the dynamic message
      data: {
        paymentId: payment.id,
        amount: payment.amount, // This is the remaining amount to pay
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

// ... (keep other functions: createPool, updatePool, etc.) ...
// --- MODIFIED (v2.9 Logging) ---
// Admin: Create a new pool
// This function is now "dumb" and accepts pre-calculated costs.
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
      totalFixedCosts,
      totalVariableCostPerUnit,
      pricingRequestId,
      debugData
    } = req.body;

    const createdPool = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUniqueOrThrow({
          where: { id: productId },
      });

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
          pricingRequestId: pricingRequestId
        },
      });

      await tx.poolFinance.create({
        data: {
          poolId: pool.id,
          baseCostPerUnit: totalVariableCostPerUnit,
          benchmarkPricePerUnit: product.benchmarkPrice, 
          totalFixedCosts: parseFloat(totalFixedCosts),
          totalVariableCostPerUnit: parseFloat(totalVariableCostPerUnit),
          calculationDebugData: debugData || null
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
        .json({ success: false, message: "Could not find Product." });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- THIS FUNCTION WAS MISSING ---
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

// --- THIS FUNCTION WAS MISSING ---
// Admin: Delete a pool
export const deletePool = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.$transaction(async (tx) => {
      await tx.review.deleteMany({ where: { poolId: id }});

      const membersToDelete = await tx.poolMember.findMany({ where: { poolId: id }});
      const paymentIdsToDelete = membersToDelete
        .map(m => m.paymentId)
        .filter(pid => pid !== null) as string[];

      if (paymentIdsToDelete.length > 0) {
        await tx.payment.deleteMany({ where: { id: { in: paymentIdsToDelete } } });
      }

      await tx.poolMember.deleteMany({ where: { poolId: id } });

      // Check if poolFinance exists before deleting
      const finance = await tx.poolFinance.findUnique({ where: { poolId: id } });
      if (finance) {
        await tx.poolFinance.delete({ where: { poolId: id } });
      }
      
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
    if (error.code === "P2003" || error.code === "P2014") {
      return res.status(409).json({
        success: false,
        message: "Cannot delete pool, check foreign key constraints (e.g., reviews, orders).",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- THIS FUNCTION WAS MISSING ---
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