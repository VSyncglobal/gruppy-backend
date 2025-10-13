import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import { PoolStatus, UserRole } from "@prisma/client";
import { updatePoolFinance } from "../hooks/poolFinanceHooks";

/**
 * 🏗️ Compute profit margin
 * Formula: (SellingPrice - BaseImportCost) / BaseImportCost
 */
function calculateProfitMargin(baseCost: number, pricePerUnit: number): number {
  if (!baseCost || baseCost <= 0) return 0;
  return (pricePerUnit - baseCost) / baseCost;
}

/**
 * 🧮 Estimate minimum joiners based on profitability
 * Ensures Gruppy breaks even after taxes + freight + profit margin
 */
function estimateMinJoiners(baseCost: number, pricePerUnit: number, targetQty: number): number {
  const profitPerItem = pricePerUnit - baseCost;
  if (profitPerItem <= 0) return targetQty; // no profit scenario
  const requiredProfit = baseCost * 0.05 * targetQty; // baseline 5% profit
  const minJoiners = Math.ceil(requiredProfit / profitPerItem);
  return Math.max(5, Math.min(minJoiners, targetQty)); // between 5 and total target
}

/**
 * ✅ CREATE POOL
 * - Auto-computes profit margin & min joiners
 * - Auto-creates corresponding PoolFinance record
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

    if (!title || !productId || !pricePerUnit || !targetQuantity || !deadline || !createdById) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 🔍 Fetch product cost base (import cost simulation)
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ error: "Product not found" });

    const baseCost = product.basePrice;
    const margin = calculateProfitMargin(baseCost, Number(pricePerUnit));
    const minJoiners = estimateMinJoiners(baseCost, Number(pricePerUnit), Number(targetQuantity));

    // ✅ Create Pool
    const pool = await prisma.pool.create({
      data: {
        title,
        description,
        productId,
        pricePerUnit: Number(pricePerUnit),
        targetQuantity: Number(targetQuantity),
        deadline: new Date(deadline),
        createdById,
        currentQuantity: 0,
        status: PoolStatus.OPEN,
        // @ts-ignore custom field (ensure added in schema if needed)
        profitMargin: margin,
        minJoiners,
      },
    });

    // ✅ Auto-create PoolFinance record
    await prisma.poolFinance.create({
      data: {
        poolId: pool.id,
        baseCostPerUnit: baseCost,
        logisticCost: 0,
        totalRevenue: 0,
        totalCost: 0,
        grossProfit: 0,
        platformEarning: 0,
        memberSavings: 0,
      },
    });

    res.json({
      success: true,
      message: "✅ Pool created successfully with financial tracking.",
      data: pool,
    });
  } catch (error) {
    console.error("❌ Error creating pool:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

/**
 * ✅ JOIN POOL
 * - Adds user as member
 * - Updates quantity, status, progress
 * - Triggers finance recalculation
 */
export async function joinPool(req: Request, res: Response) {
  try {
    const { poolId, quantity } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const pool = await prisma.pool.findUnique({ where: { id: poolId } });
    if (!pool) return res.status(404).json({ error: "Pool not found" });
    if (pool.status !== PoolStatus.OPEN) {
      return res.status(400).json({ error: "Pool is not open for joining" });
    }

    const existingMember = await prisma.poolMember.findFirst({ where: { poolId, userId } });
    if (existingMember) {
      return res.status(400).json({ error: "User already joined this pool" });
    }

    const qty = quantity ? Number(quantity) : 1;
    const newQuantity = pool.currentQuantity + qty;
    const progress = (newQuantity / pool.targetQuantity) * 100;

    let newStatus: PoolStatus = pool.status;
    if (newQuantity >= pool.targetQuantity) newStatus = PoolStatus.FILLED;
    else if ((pool as any).minJoiners && newQuantity >= (pool as any).minJoiners)
      newStatus = PoolStatus.READY_TO_SHIP;

    const [member, updatedPool] = await prisma.$transaction([
      prisma.poolMember.create({ data: { poolId, userId, quantity: qty } }),
      prisma.pool.update({
        where: { id: poolId },
        data: {
          currentQuantity: newQuantity,
          status: newStatus,
          // @ts-ignore optional schema field
          progress,
        },
      }),
    ]);

    // 🔁 Update financial metrics
    await updatePoolFinance(poolId);

    res.json({
      success: true,
      message:
        newStatus === PoolStatus.FILLED
          ? "✅ Pool filled — no more members can join."
          : newStatus === PoolStatus.READY_TO_SHIP
          ? "✅ Pool reached minimum joiners — shipping preparation can begin!"
          : "✅ Joined pool successfully.",
      data: { member, updatedPool },
    });
  } catch (error) {
    console.error("❌ Error joining pool:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

/**
 * ✅ GET ALL POOLS (Role-based view)
 * - Consumers: Hide sensitive data
 * - Admins: See profit, cumulative revenue, and savings
 */
export async function getPools(req: Request, res: Response) {
  try {
    const role = (req as any).user?.role || "CONSUMER";
    const pools = await prisma.pool.findMany({
      include: {
        product: true,
        members: true,
        creator: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = pools.map((pool) => {
      const progress = (pool.currentQuantity / pool.targetQuantity) * 100;
      return {
        ...pool,
        progress: Math.round(progress),
        ...(role === UserRole.ADMIN
          ? {
              profitMargin: (pool as any).profitMargin,
              cumulativeAmount: pool.currentQuantity * pool.pricePerUnit,
            }
          : {}),
      };
    });

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error("❌ Error fetching pools:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

/**
 * ✅ GET POOL BY ID
 * - Returns role-based details and progress
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

    const progress = (pool.currentQuantity / pool.targetQuantity) * 100;

    const result = {
      ...pool,
      progress: Math.round(progress),
      ...(role === UserRole.ADMIN
        ? {
            profitMargin: (pool as any).profitMargin,
            cumulativeAmount: pool.currentQuantity * pool.pricePerUnit,
            finance: pool.finance,
          }
        : {}),
    };

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("❌ Error fetching pool:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
