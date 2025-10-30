import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import { UserRole } from "@prisma/client";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

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
      },
    });
    res.json({ success: true, data: users });
  } catch (error) {
    logger.error("Error fetching all users:", error);
    Sentry.captureException(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

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
    logger.error("Error promoting user:", error);
    Sentry.captureException(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

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

    const existingAffiliate = await prisma.affiliate.findUnique({ where: { userId } });
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
  } catch (error) {
    logger.error("Error creating affiliate:", error);
    Sentry.captureException(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

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
        logger.error("Error fetching affiliates:", error);
        Sentry.captureException(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};