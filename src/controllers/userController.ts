// src/controllers/userController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import { PoolStatus } from "@prisma/client";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";
import bcrypt from "bcryptjs";
import { generateVerificationToken } from "../utils/token";
import mailService from "../services/mailService";

// Get user profile
export const getUserProfile = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const userProfile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      phone: true,
      createdAt: true,
      emailVerificationToken: true,
      accountBalance: true,
    },
  });
  res.json(userProfile);
};

// Update user profile
export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { name, phone } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name, phone },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        phone: true,
        createdAt: true,
        accountBalance: true,
      },
    });

    res.status(200).json({ success: true, data: updatedUser });
  } catch (error: any) {
    logger.error("Error updating user profile:", error);
    Sentry.captureException(error);
    if (error.code === "P2002" && error.meta?.target?.includes("phone")) {
      return res
        .status(409)
        .json({ success: false, message: "Phone number is already in use" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Example: changeEmail function using Resend templates
export const changeEmail = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { email } = req.body;

    const currentUser = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (currentUser.email === email) {
      return res.status(400).json({
        success: false,
        message: "This is already your current email address.",
      });
    }

    const verificationToken = generateVerificationToken();
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        email,
        emailVerified: false,
        emailVerificationToken: verificationToken,
      },
    });

    const verificationUrl = `${
      process.env.FRONTEND_URL || "http://localhost:3001"
    }/verify-email?token=${verificationToken}`;

    // --- Send verification email using Resend template ---
    await mailService.sendEmail({
      to: updatedUser.email,
      from: "Gruppy <noreply@gruppy.store>", // optional override
      template: {
        id: "verify-email", // Your template ID in Resend
        variables: {
          name: updatedUser.name,
          verificationUrl,
          code: verificationToken,
        },
      },
    });

    res.status(200).json({
      success: true,
      message:
        "Email change initiated. Please check your new email address to verify it.",
    });
  } catch (error: any) {
    logger.error("Error changing user email:", error);
    Sentry.captureException(error);
    if (error.code === "P2002" && error.meta?.target?.includes("email")) {
      return res
        .status(409)
        .json({ success: false, message: "Email is already in use" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get user's pools
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
      orderBy: { joinedAt: "desc" },
    });

    const myPools = poolMemberships.map((pm) => pm.pool);
    res.status(200).json({ success: true, data: myPools });
  } catch (error: any) {
    logger.error("Error fetching user's pools:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// User dashboard stats
export const getUserDashboardStats = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const totalJoinedPools = await prisma.poolMember.count({ where: { userId } });

    const completedMemberships = await prisma.poolMember.findMany({
      where: {
        userId,
        pool: { status: PoolStatus.DELIVERED },
      },
      include: { pool: { include: { finance: true } } },
    });

    const totalSavings = completedMemberships.reduce((acc, pm) => {
      if (pm.pool.finance && pm.pool.finance.memberSavings) {
        const userQuantity = pm.quantity;
        const totalQuantity = pm.pool.currentQuantity;
        const userShare = (userQuantity / totalQuantity) * pm.pool.finance.memberSavings;
        return acc + userShare;
      }
      return acc;
    }, 0);

    res.status(200).json({
      success: true,
      data: {
        totalJoinedPools,
        totalSavings: Math.ceil(totalSavings),
      },
    });
  } catch (error: any) {
    logger.error("Error fetching user dashboard stats:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Change user password
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

// Get user addresses
export const getUserAddresses = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const addresses = await prisma.userAddress.findMany({
      where: { userId },
      orderBy: { isDefault: "desc" },
    });
    res.status(200).json({ success: true, data: addresses });
  } catch (error: any) {
    logger.error("Error fetching user addresses:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create new address
export const createAddress = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { name, addressLine1, town, county, isDefault } = req.body;

    const addressCount = await prisma.userAddress.count({ where: { userId } });
    if (addressCount >= 3) {
      return res.status(400).json({
        success: false,
        message: "You can only save up to 3 addresses.",
      });
    }

    if (isDefault) {
      await prisma.userAddress.updateMany({ where: { userId }, data: { isDefault: false } });
    }

    const newAddress = await prisma.userAddress.create({
      data: { userId, name, addressLine1, town, county, isDefault: isDefault || false },
    });

    res.status(201).json({ success: true, data: newAddress });
  } catch (error: any) {
    logger.error("Error creating user address:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update an address
export const updateAddress = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { addressId } = req.params;
    const { name, addressLine1, town, county, isDefault } = req.body;

    if (isDefault) {
      await prisma.userAddress.updateMany({
        where: { userId, NOT: { id: addressId } },
        data: { isDefault: false },
      });
    }

    const updatedAddress = await prisma.userAddress.update({
      where: { id: addressId },
      data: {
        user: { connect: { id: userId } },
        name,
        addressLine1,
        town,
        county,
        isDefault,
      },
    });

    res.status(200).json({ success: true, data: updatedAddress });
  } catch (error: any) {
    logger.error("Error updating user address:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, message: "Address not found or unauthorized" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete an address
export const deleteAddress = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { addressId } = req.params;

    const address = await prisma.userAddress.findFirstOrThrow({ where: { id: addressId, userId } });
    await prisma.userAddress.delete({ where: { id: address.id } });

    res.status(204).send();
  } catch (error: any) {
    logger.error("Error deleting user address:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, message: "Address not found or unauthorized" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};
