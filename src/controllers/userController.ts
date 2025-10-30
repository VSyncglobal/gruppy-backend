// src/controllers/userController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import { PoolStatus } from "@prisma/client";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

// This function was already here
export const getUserProfile = async (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
};

// ✅ --- NEW FUNCTIONS START HERE --- ✅

export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { name, email } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        email,
      },
    });

    // Exclude password_hash from the response
    const { password_hash, ...userResponse } = updatedUser;
    res.status(200).json({ success: true, data: userResponse });
  } catch (error: any) {
    logger.error("Error updating user profile:", error);
    Sentry.captureException(error);
    if (error.code === "P2002" && error.meta?.target?.includes("email")) {
      return res
        .status(409)
        .json({ success: false, message: "Email is already in use" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyPools = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const poolMemberships = await prisma.poolMember.findMany({
      where: { userId },
      include: {
        pool: {
          include: {
            product: true, // Include product details
            finance: true, // Include finance details (for savings)
          },
        },
      },
      orderBy: {
        joinedAt: "desc",
      },
    });

    // Return just the pool data, which now includes the status
    const myPools = poolMemberships.map((pm) => pm.pool);

    res.status(200).json({ success: true, data: myPools });
  } catch (error: any) {
    logger.error("Error fetching user's pools:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserDashboardStats = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    // 1. Get total joined pools
    const totalJoinedPools = await prisma.poolMember.count({
      where: { userId },
    });

    // 2. Get total savings from COMPLETED pools
    const completedMemberships = await prisma.poolMember.findMany({
      where: {
        userId,
        pool: {
          status: PoolStatus.DELIVERED, // Only count savings from delivered pools
        },
      },
      include: {
        pool: {
          include: {
            finance: true,
          },
        },
      },
    });

    // Sum up the savings
    const totalSavings = completedMemberships.reduce((acc, pm) => {
      if (pm.pool.finance && pm.pool.finance.memberSavings) {
        // This sums the total 'memberSavings' from the finance record of each delivered pool
        return acc + pm.pool.finance.memberSavings;
      }
      return acc;
    }, 0);

    res.status(200).json({
      success: true,
      data: {
        totalJoinedPools,
        totalSavings,
      },
    });
  } catch (error: any) {
    logger.error("Error fetching user dashboard stats:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};