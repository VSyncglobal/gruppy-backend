import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import { PoolStatus } from "@prisma/client";

// ✅ Create Pool
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

    // ✅ Validate required fields
    if (!title || !productId || !pricePerUnit || !targetQuantity || !deadline || !createdById) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const pool = await prisma.pool.create({
      data: {
        title,
        description,
        productId,
        pricePerUnit: Number(pricePerUnit),
        targetQuantity: Number(targetQuantity),
        deadline: new Date(deadline),
        createdById,
      },
    });

    res.json({ success: true, data: pool });
  } catch (error) {
    console.error("❌ Error creating pool:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// ✅ Join an existing pool
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

    const existingMember = await prisma.poolMember.findFirst({
      where: { poolId, userId },
    });
    if (existingMember) {
      return res.status(400).json({ error: "User already joined this pool" });
    }

    const qty = quantity ? Number(quantity) : 1;
    const member = await prisma.poolMember.create({
      data: {
        poolId,
        userId,
        quantity: qty,
      },
    });

    const newQuantity = pool.currentQuantity + qty;
    let newStatus: PoolStatus = pool.status; // ✅ FIX: explicitly declare type

    if (newQuantity >= pool.targetQuantity) {
      newStatus = PoolStatus.FILLED;
    } else if (
      typeof (pool as any).minJoiners === "number" &&
      newQuantity >= (pool as any).minJoiners
    ) {
      newStatus = PoolStatus.READY_TO_SHIP;
    }

    const updatedPool = await prisma.pool.update({
      where: { id: poolId },
      data: {
        currentQuantity: newQuantity,
        status: newStatus,
      },
    });

    res.json({
      success: true,
      message:
        newStatus === PoolStatus.FILLED
          ? "✅ Pool is now filled — no more members can join."
          : newStatus === PoolStatus.READY_TO_SHIP
          ? "✅ Pool reached minimum joiners and is now active!"
          : "✅ Joined pool successfully.",
      data: { member, updatedPool },
    });
  } catch (error) {
    console.error("❌ Error joining pool:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}


// ✅ Get all pools
export async function getPools(req: Request, res: Response) {
  try {
    const pools = await prisma.pool.findMany({
      include: {
        product: true,
        members: true,
        creator: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: pools });
  } catch (error) {
    console.error("❌ Error fetching pools:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}


// ✅ Get pool by ID
export async function getPoolById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const pool = await prisma.pool.findUnique({
      where: { id },
      include: {
        product: true,
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    if (!pool) return res.status(404).json({ error: "Pool not found" });

    res.json({ success: true, data: pool });
  } catch (error) {
    console.error("❌ Error fetching pool:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
