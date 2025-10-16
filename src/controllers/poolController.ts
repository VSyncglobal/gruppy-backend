import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import { PoolStatus, UserRole } from "@prisma/client";
import { updatePoolFinance } from "../hooks/poolFinanceHooks";

// Helper functions can remain as they are good utility functions
function calculateProfitMargin(baseCost: number, pricePerUnit: number): number {
  if (!baseCost || baseCost <= 0) return 0;
  return (pricePerUnit - baseCost) / baseCost;
}

function estimateMinJoiners(baseCost: number, pricePerUnit: number, targetQty: number): number {
  const profitPerItem = pricePerUnit - baseCost;
  if (profitPerItem <= 0) return targetQty;
  const requiredProfit = baseCost * 0.05 * targetQty;
  const minJoiners = Math.ceil(requiredProfit / profitPerItem);
  return Math.max(5, Math.min(minJoiners, targetQty));
}

/**
 * ✅ CREATE POOL
 * - Auto-computes profit margin & min joiners
 * - Auto-creates corresponding PoolFinance record within a transaction
 */
export async function createPool(req: Request, res: Response) {
  try {
    const {
      title,
      description,
      productId,
      pricePerUnit,
      targetQuantity,
      deadline,
      createdById,
    } = req.body;


    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ error: "Product not found" });

    const baseCost = product.basePrice;
    const margin = calculateProfitMargin(baseCost, Number(pricePerUnit));
    const minJoiners = estimateMinJoiners(baseCost, Number(pricePerUnit), Number(targetQuantity));

    // ✨ Use a transaction to create the Pool and its associated PoolFinance record together
    const newPool = await prisma.$transaction(async (tx) => {
      const pool = await tx.pool.create({
        data: {
          title,
          description,
          productId,
          pricePerUnit: Number(pricePerUnit),
          targetQuantity: Number(targetQuantity),
          deadline: new Date(deadline),
          createdById,
          minJoiners,
          // Storing profitMargin and progress on the pool model is okay for denormalization
          // but ensure these fields exist in your `schema.prisma` file.
          // For now, we will rely on the PoolFinance record as the source of truth.
        },
      });

      // Call the finance hook to create the initial financial record
      await updatePoolFinance(tx, pool.id);

      return pool;
    });

    res.status(201).json({
      success: true,
      message: "✅ Pool created successfully with financial tracking.",
      data: newPool,
    });
  } catch (error) {
    console.error("❌ Error creating pool:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}


/**
 * ✅ JOIN POOL (Refactored for Transactional Integrity)
 * - Adds user, updates pool, and recalculates finance in a single atomic operation.
 */
export async function joinPool(req: Request, res: Response) {
  try {
    const { poolId, quantity } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // ✨ WRAP THE ENTIRE LOGIC IN A PRISMA TRANSACTION
    const transactionResult = await prisma.$transaction(async (tx) => {
      const pool = await tx.pool.findUnique({ where: { id: poolId } });
      if (!pool) throw new Error("Pool not found");

      if (pool.status !== PoolStatus.OPEN) {
        throw new Error("Pool is not open for joining");
      }

      const existingMember = await tx.poolMember.findFirst({
        where: { poolId, userId },
      });
      if (existingMember) {
        throw new Error("User already joined this pool");
      }

      const qty = quantity ? Number(quantity) : 1;
      const member = await tx.poolMember.create({
        data: {
          poolId,
          userId,
          quantity: qty,
        },
      });

      const newQuantity = pool.currentQuantity + qty;
      let newStatus: PoolStatus = pool.status;

      if (newQuantity >= pool.targetQuantity) {
        newStatus = PoolStatus.FILLED;
      } else if (newQuantity >= pool.minJoiners) {
        newStatus = PoolStatus.READY_TO_SHIP;
      }

      const updatedPool = await tx.pool.update({
        where: { id: poolId },
        data: {
          currentQuantity: newQuantity,
          status: newStatus,
        },
      });

      // ✅ Correctly call the finance hook with the transaction client and poolId
      await updatePoolFinance(tx, poolId);

      return { member, updatedPool, newStatus };
    });

    res.json({
      success: true,
      message:
        transactionResult.newStatus === PoolStatus.FILLED
          ? "✅ Pool filled — no more members can join."
          : transactionResult.newStatus === PoolStatus.READY_TO_SHIP
          ? "✅ Pool reached minimum joiners — shipping preparation can begin!"
          : "✅ Joined pool successfully.",
      data: {
        member: transactionResult.member,
        updatedPool: transactionResult.updatedPool,
      },
    });
  } catch (error: any) {
    console.error("❌ Error joining pool:", error.message);
    res.status(400).json({ error: error.message || "Failed to join pool" });
  }
}

// The GET functions can remain largely the same, but should fetch from PoolFinance
// for financial data to ensure it's the single source of truth.

/**
 * ✅ GET ALL POOLS (Refactored for Accuracy)
 * - Fetches financial data from the related PoolFinance record for Admins.
 */
export async function getPools(req: Request, res: Response) {
  try {
    const role = (req as any).user?.role || "CONSUMER";
    const pools = await prisma.pool.findMany({
      include: {
        product: true,
        creator: { select: { id: true, name: true, email: true } },
        finance: true, // Eager load the finance record
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = pools.map((pool) => {
      const progress = pool.targetQuantity > 0 ? (pool.currentQuantity / pool.targetQuantity) * 100 : 0;
      const adminData =
        role === UserRole.ADMIN && pool.finance
          ? {
              finance: pool.finance,
            }
          : {};

      // Remove sensitive data for consumers
      const { finance, ...restOfPool } = pool;

      return {
        ...restOfPool,
        progress: Math.round(progress),
        ...(adminData),
      };
    });

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error("❌ Error fetching pools:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

/**
 * ✅ GET POOL BY ID (Refactored for Accuracy)
 * - Fetches financial data from the related PoolFinance record for Admins.
 */
export async function getPoolById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const role = (req as any).user?.role || "CONSUMER";

    const pool = await prisma.pool.findUnique({
      where: { id },
      include: {
        product: true,
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        creator: { select: { id: true, name: true, email: true } },
        finance: true,
      },
    });

    if (!pool) return res.status(404).json({ error: "Pool not found" });

    const progress = pool.targetQuantity > 0 ? (pool.currentQuantity / pool.targetQuantity) * 100 : 0;
    
    // Conditionally hide finance data based on role
    if (role !== UserRole.ADMIN) {
      delete (pool as any).finance;
    }

    const result = {
      ...pool,
      progress: Math.round(progress),
    };

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("❌ Error fetching pool:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}