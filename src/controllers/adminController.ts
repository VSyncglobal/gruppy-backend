import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import { UserRole } from "@prisma/client";

/**
 * [ADMIN] Fetches a list of all users in the system.
 */
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { // Only select non-sensitive fields
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
    res.json({ success: true, data: users });
  } catch (error) {
    console.error("Error fetching all users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * [ADMIN] Promotes a user to the ADMIN role.
 */
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
  } catch (error) {
    console.error("Error promoting user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * [ADMIN] Creates an affiliate profile for an existing user.
 */
export const createAffiliate = async (req: Request, res: Response) => {
  try {
    const { userId, commissionRate } = req.body;
  

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (user.role !== "CONSUMER") {
        return res.status(400).json({ error: "User must be a CONSUMER to be promoted to AFFILIATE." });
    }

    // Check if an affiliate profile already exists for this user
    const existingAffiliate = await prisma.affiliate.findUnique({ where: { userId } });
    if (existingAffiliate) {
      return res.status(400).json({ error: "User is already an affiliate." });
    }

    // Generate a unique affiliate code
    const code = `AFF${Math.floor(1000 + Math.random() * 9000)}`;

    const [updatedUser, newAffiliate] = await prisma.$transaction([
      // 1. Update the user's role
      prisma.user.update({
        where: { id: userId },
        data: { role: UserRole.AFFILIATE },
      }),
      // 2. Create the affiliate profile
      prisma.affiliate.create({
        data: {
          userId,
          code,
          commissionRate: commissionRate ? parseFloat(commissionRate) : 0.05, // Default 5%
        },
      }),
    ]);

    res.status(201).json({
      success: true,
      message: `User ${updatedUser.email} is now an affiliate with code ${newAffiliate.code}.`,
      data: newAffiliate,
    });
  } catch (error) {
    console.error("Error creating affiliate:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * [ADMIN] Fetches a list of all affiliates.
 */
export const getAllAffiliates = async (req: Request, res: Response) => {
    try {
        const affiliates = await prisma.affiliate.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: { name: true, email: true }
                }
            }
        });
        res.json({ success: true, data: affiliates });
    } catch (error) {
        console.error("Error fetching affiliates:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};