// src/controllers/poolController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";
import { PoolStatus, PaymentStatus } from "@prisma/client";

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
  const { quantity, paymentId } = req.body;
  const userId = (req as any).user.id;

  try {
    const transactionResult = await prisma.$transaction(async (tx) => {
      const pool = await tx.pool.findUnique({
        where: { id: poolId },
      });

      if (!pool) {
        throw new Error("Pool not found");
      }
      
      if (pool.status !== PoolStatus.FILLING) {
        throw new Error("This pool is not open for joining.");
      }

      if (pool.deadline < new Date()) {
        throw new Error("This pool's deadline has passed.");
      }

      // ✅ FIX 1: Include the poolMember relation
      const payment = await tx.payment.findUnique({
        where: { id: paymentId, status: PaymentStatus.SUCCESS },
        include: { poolMember: true },
      });

      // ✅ FIX 1 (cont.): Now this check works
      if (!payment || payment.poolMember) {
        throw new Error("Invalid or already used payment ID.");
      }

      const newQuantity = pool.currentQuantity + quantity;
      
      // ✅ FIX 2: Explicitly type `newStatus`
      let newStatus: PoolStatus = pool.status;

      if (newQuantity >= pool.targetQuantity) {
        // ✅ FIX 2 (cont.): This assignment is now valid
        newStatus = PoolStatus.CLOSED;
      }
      
      const updatedPool = await tx.pool.update({
        where: { id: poolId },
        data: {
          currentQuantity: newQuantity,
          status: newStatus,
          progress: (newQuantity / pool.targetQuantity) * 100,
          cumulativeValue: newQuantity * pool.pricePerUnit,
        },
      });

      const poolMember = await tx.poolMember.create({
        data: {
          poolId,
          userId,
          quantity,
          paymentId,
        },
      });

      await tx.payment.update({
        where: { id: paymentId },
        data: {
          poolMember: {
            connect: { id: poolMember.id },
          },
        },
      });

      return { updatedPool, poolMember, newStatus };
    });

    res.status(201).json({
      success: true,
      data: {
        poolMember: transactionResult.poolMember,
        pool: transactionResult.updatedPool,
      },
    });

    // ✅ FIX 2 (cont.): This comparison is now valid
    if (transactionResult.newStatus === PoolStatus.CLOSED) {
      logger.info(`Pool ${poolId} has been filled and is now CLOSED.`);
      // TODO: Send notification to admin
    }

  // ✅ FIX 3: Removed the underscore
  } catch (error: any) { 
    // ✅ FIX 3 (cont.): All 'error' variables are now found
    logger.error(`Error joining pool ${poolId} for user ${userId}:`, error);
    Sentry.captureException(error, {
      extra: { poolId, userId, paymentId, quantity },
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
      imageUrl,
      productId,
      pricePerUnit,
      targetQuantity,
      minJoiners,
      deadline,
      baseCostPerUnit,
    } = req.body;

    const createdPool = await prisma.$transaction(async (tx) => {
      const pool = await tx.pool.create({
        data: {
          title,
          description,
          imageUrl,
          productId,
          pricePerUnit: parseFloat(pricePerUnit),
          targetQuantity: parseInt(targetQuantity, 10),
          minJoiners: parseInt(minJoiners, 10),
          deadline: new Date(deadline),
          createdById: (req as any).user.id,
          status: PoolStatus.FILLING, 
        },
      });

      await tx.poolFinance.create({
        data: {
          poolId: pool.id,
          baseCostPerUnit: parseFloat(baseCostPerUnit),
        },
      });
      return pool;
    });

    res.status(2201).json({ success: true, data: createdPool });
  } catch (error: any) {
    logger.error("Error creating pool:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
       return res
        .status(404)
        .json({ success: false, message: "Product not found" });
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
      imageUrl,
      productId,
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
        imageUrl,
        productId,
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
      await tx.poolFinance.delete({ where: { poolId: id } });
      await tx.poolMember.deleteMany({ where: { poolId: id } });
      
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
     if (error.code === "P2003") {
      return res.status(409).json({
        success: false,
        message: "Cannot delete pool, check foreign key constraints (e.g., members, payments).",
      });
    }
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
      // ...
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