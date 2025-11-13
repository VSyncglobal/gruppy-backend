// src/controllers/adminController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import { UserRole } from "@prisma/client";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

// (Unchanged - getAllUsers)
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        accountBalance: true,
        emailVerified: true,
      },
    });
    res.json({ success: true, data: users });
  } catch (error: any) {
    logger.error("Error fetching all users:", error);
    Sentry.captureException(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// (Unchanged - getUserById)
export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        emailVerified: true,
        accountBalance: true,
        createdAt: true,
        updatedAt: true,
        addresses: true,
        poolMemberships: {
          select: {
            poolId: true,
            quantity: true,
            joinedAt: true,
            pool: { select: { title: true } },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, data: user });
  } catch (error: any) {
    logger.error(`Error fetching user ${req.params.id}:`, error);
    Sentry.captureException(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// (Unchanged - adminUpdateUser)
export const adminUpdateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        phone,
        role,
      },
    });
    res.json({ success: true, data: updatedUser });
  } catch (error: any) {
    logger.error(`Error updating user ${req.params.id}:`, error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "A user with this email or phone already exists.",
      });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// (Unchanged - adminDeleteUser)
export const adminDeleteUser = async (req: Request, res: Response) => {
  const { id: userId } = req.params;

  try {
    await prisma.$transaction(async (tx) => {
      const createdPools = await tx.pool.count({
        where: { createdById: userId },
      });
      if (createdPools > 0) {
        throw new Error(
          "Cannot delete user: This user is the creator of one or more pools. Please re-assign or delete those pools first."
        );
      }
      await tx.poolMember.deleteMany({ where: { userId } });
      await tx.review.deleteMany({ where: { userId } });
      await tx.affiliate.deleteMany({ where: { userId } });
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.passwordResetToken.deleteMany({ where: { userId } });
      await tx.userAddress.deleteMany({ where: { userId } });
      await tx.aiSuggestionLog.deleteMany({ where: { userId } });
      await tx.pricingLog.deleteMany({ where: { userId } });
      await tx.priceCalculationLog.deleteMany({ where: { userId } });
      await tx.pricingRequest.deleteMany({ where: { userId } });
      await tx.user.delete({
        where: { id: userId },
      });
    });

    res.status(204).send();
  } catch (error: any) {
    logger.error(`Error deleting user ${userId}:`, error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }
    if (error.message.includes("Cannot delete user:")) {
      return res.status(409).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// (Unchanged - promoteUserToAdmin)
export const promoteUserToAdmin = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    const userToPromote = await prisma.user.findUnique({ where: { id: userId } });
    if (!userToPromote) {
      return res.status(404).json({ error: "User not found" });
    }

    if (userToPromote.role === UserRole.ADMIN) {
      return res.status(400).json({ message: "User is already an admin." });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.ADMIN },
    });

    res.json({
      success: true,
      message: `Successfully promoted ${updatedUser.email} to ADMIN.`,
      data: updatedUser,
    });
  } catch (error: any) {
    logger.error("Error promoting user:", error);
    Sentry.captureException(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// (Unchanged - createAffiliate)
export const createAffiliate = async (req: Request, res: Response) => {
  try {
    const { userId, commissionRate } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (user.role !== "CONSUMER") {
      return res
        .status(400)
        .json({ error: "User must be a CONSUMER to be promoted to AFFILIATE." });
    }

    const existingAffiliate = await prisma.affiliate.findUnique({
      where: { userId },
    });
    if (existingAffiliate) {
      return res.status(400).json({ error: "User is already an affiliate." });
    }

    const code = `AFF${Math.floor(1000 + Math.random() * 9000)}`;

    const [updatedUser, newAffiliate] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { role: UserRole.AFFILIATE },
      }),
      prisma.affiliate.create({
        data: {
          userId,
          code,
          commissionRate: commissionRate ? parseFloat(commissionRate) : 0.05,
        },
      }),
    ]);

    res.status(201).json({
      success: true,
      message: `User ${updatedUser.email} is now an affiliate with code ${newAffiliate.code}.`,
      data: newAffiliate,
    });
  } catch (error: any) {
    logger.error("Error creating affiliate:", error);
    Sentry.captureException(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// (Unchanged - getAllAffiliates)
export const getAllAffiliates = async (req: Request, res: Response) => {
  try {
    const affiliates = await prisma.affiliate.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    });
    res.json({ success: true, data: affiliates });
  } catch (error: any) {
    logger.error("Error fetching affiliates:", error);
    Sentry.captureException(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * --- NEW (v_phase6) ---
 * Admin: Update an affiliate's commission rate
 */
export const updateAffiliate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // This is the Affiliate ID
    const { commissionRate } = req.body;

    const updatedAffiliate = await prisma.affiliate.update({
      where: { id },
      data: {
        commissionRate: commissionRate ? parseFloat(commissionRate) : undefined,
      },
    });

    res.status(200).json({ success: true, data: updatedAffiliate });
  } catch (error: any) {
    logger.error(`Error updating affiliate ${req.params.id}:`, error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Affiliate not found." });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * --- NEW (v_phase6) ---
 * Admin: Delete an affiliate record (and demote user back to CONSUMER)
 */
export const deleteAffiliate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // This is the Affiliate ID

    // Find the affiliate to get their userId
    const affiliate = await prisma.affiliate.findUniqueOrThrow({
      where: { id },
    });

    // Demote user and delete affiliate in a transaction
    await prisma.$transaction([
      // 1. Demote user
      prisma.user.update({
        where: { id: affiliate.userId },
        data: { role: UserRole.CONSUMER },
      }),
      // 2. Delete affiliate record
      prisma.affiliate.delete({
        where: { id },
      }),
    ]);

    res.status(204).send();
  } catch (error: any) {
    logger.error(`Error deleting affiliate ${req.params.id}:`, error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Affiliate not found." });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// (Unchanged - creditUserBalance)
export const creditUserBalance = async (req: Request, res: Response) => {
  try {
    const { id: userId } = req.params;
    const { amount, reason } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        accountBalance: {
          increment: amount,
        },
      },
    });

    // TODO: We should log this transaction to a new table
    logger.info(`Admin credited user ${userId} with ${amount}. Reason: ${reason}`);

    res.status(200).json({
      success: true,
      data: {
        userId: user.id,
        newBalance: user.accountBalance,
      },
    });
  } catch (error: any) {
    logger.error("Error crediting user balance:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};