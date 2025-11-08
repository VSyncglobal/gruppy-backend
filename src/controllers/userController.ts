// src/controllers/userController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import { PoolStatus } from "@prisma/client";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node"; // Correct Sentry import
import bcrypt from "bcryptjs";
import { generateVerificationToken } from "../utils/token";
import mailService from "../services/mailService";

/**
 * --- MODIFIED (v1.3) ---
 * Gets the logged-in user's profile.
 * REMOVED 'address' and 'location'.
 * ADDED 'accountBalance'.
 */
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
      accountBalance: true, // --- NEW (v1.3) ---
      // 'address' and 'location' are removed
    },
  });
  res.json(userProfile);
};

/**
 * --- MODIFIED (v1.3) ---
 * Updates basic user info (name, phone).
 * Email and address changes are handled by dedicated functions.
 */
export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { name, phone } = req.body; // Only name and phone

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        phone,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        phone: true,
        createdAt: true,
        accountBalance: true, // --- NEW (v1.3) ---
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

/**
 * --- NEW (v1.3): Handles request to change user's email ---
 * This triggers a re-verification process.
 */
export const changeEmail = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { email } = req.body;

    // Check if user is trying to change to their current email
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
        email: email, // Update the email
        emailVerified: false, // Mark as unverified
        emailVerificationToken: verificationToken, // Set new token
      },
    });

    // Send verification email to the *new* address
    const verificationUrl = `${
      process.env.FRONTEND_URL || "http://localhost:3001"
    }/verify-email?token=${verificationToken}`;
    await mailService.sendEmail({
      to: updatedUser.email,
      subject: "Please verify your new Gruppy email address",
      text: `You requested to change your email. Please click the link to verify this new email address: ${verificationUrl}`,
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

// --- UNCHANGED ---
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

// --- UNCHANGED ---
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

// --- UNCHANGED ---
export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password_hash
    );
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid current password" });
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

// --- DEPRECATED (v1.3) ---
export const updatePhone = async (req: Request, res: Response) => {
  res.status(400).json({
    success: false,
    message: "This endpoint is deprecated. Use PUT /api/users/profile instead.",
  });
};

// --- NEW (v1.3): Address Management ---

/**
 * --- NEW (v1.3): Get all saved addresses for a user ---
 */
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

/**
 * --- NEW (v1.3): Create a new saved address for a user ---
 */
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

    // If setting this as default, unset all others
    if (isDefault) {
      await prisma.userAddress.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const newAddress = await prisma.userAddress.create({
      data: {
        userId,
        name,
        addressLine1,
        town,
        county,
        isDefault: isDefault || false,
      },
    });

    res.status(201).json({ success: true, data: newAddress });
  } catch (error: any) {
    logger.error("Error creating user address:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * --- NEW (v1.3): Update a specific saved address ---
 */
export const updateAddress = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { addressId } = req.params;
    const { name, addressLine1, town, county, isDefault } = req.body;

    // If setting this as default, unset all others
    if (isDefault) {
      await prisma.userAddress.updateMany({
        where: { userId, NOT: { id: addressId } },
        data: { isDefault: false },
      });
    }

    const updatedAddress = await prisma.userAddress.update({
      where: { id: addressId },
      data: {
        // Ensure user can't update another user's address
        user: { connect: { id: userId } },
        name,
        addressLine1,
        town,
        county,
        isDefault: isDefault,
      },
    });

    res.status(200).json({ success: true, data: updatedAddress });
  } catch (error: any) {
    logger.error("Error updating user address:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Address not found or unauthorized" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * --- NEW (v1.3): Delete a specific saved address ---
 */
export const deleteAddress = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { addressId } = req.params;

    // Verify the address belongs to the user before deleting
    const address = await prisma.userAddress.findFirstOrThrow({
      where: { id: addressId, userId },
    });

    await prisma.userAddress.delete({
      where: { id: address.id },
    });

    res.status(204).send();
  } catch (error: any) {
    logger.error("Error deleting user address:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Address not found or unauthorized" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};