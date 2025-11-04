// src/controllers/userController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import { PoolStatus } from "@prisma/client";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

// ✅ --- NEW IMPORT ---
import bcrypt from 'bcryptjs';

// This function was already here
export const getUserProfile = async (req: Request, res: Response) => {
  const user = (req as any).user;
  // ✅ --- MODIFIED: Return all new profile fields ---
  const userProfile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      phone: true,
      address: true,
      location: true,
      createdAt: true
    }
  });
  res.json(userProfile);
};

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
      // ✅ --- MODIFIED: Return all new profile fields ---
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        phone: true,
        address: true,
        location: true,
        createdAt: true
      }
    });

    res.status(200).json({ success: true, data: updatedUser });
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
            product: true,
            finance: true,
          },
        },
      },
      orderBy: {
        joinedAt: "desc",
      },
    });

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

    const totalJoinedPools = await prisma.poolMember.count({
      where: { userId },
    });

    const completedMemberships = await prisma.poolMember.findMany({
      where: {
        userId,
        pool: {
          status: PoolStatus.DELIVERED,
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

    const totalSavings = completedMemberships.reduce((acc, pm) => {
      if (pm.pool.finance && pm.pool.finance.memberSavings) {
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


// --- ✅ NEW FUNCTIONS FOR PHASE 1 ---

export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Invalid current password" });
    }

    const newHashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password_hash: newHashedPassword },
    });

    res.status(200).json({ success: true, message: "Password updated successfully" });
  } catch (error: any) {
    logger.error("Error changing password:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePhone = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { phone } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { phone },
      select: { id: true, name: true, email: true, role: true, emailVerified: true, phone: true, address: true, location: true, createdAt: true },
    });
    res.status(200).json({ success: true, data: updatedUser });
  } catch (error: any) {
    logger.error("Error updating phone:", error);
    Sentry.captureException(error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: "This phone number is already in use." });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAddress = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { address, location } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { address, location },
      select: { id: true, name: true, email: true, role: true, emailVerified: true, phone: true, address: true, location: true, createdAt: true },
    });
    res.status(200).json({ success: true, data: updatedUser });
  } catch (error: any) {
    logger.error("Error updating address:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};