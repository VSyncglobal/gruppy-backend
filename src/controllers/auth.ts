import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../utils/prismaClient";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import { UserRole } from "@prisma/client";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

export const register = async (req: Request, res: Response) => {
  try {
    let { name, email, password, role } = req.body;
    email = email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password_hash: hashedPassword,
        role: role || UserRole.CONSUMER,
      },
    });

    const userResponse = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.status(201).json({ success: true, user: userResponse });
  } catch (error) {
    logger.error("Registration error:", error);
    Sentry.captureException(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    let { email, password } = req.body;
    email = email.toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    res.json({ success: true, data: { accessToken, refreshToken } });
  } catch (error) {
    logger.error("Login error:", error);
    Sentry.captureException(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const refresh = async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(401).json({ error: "Refresh token is required" });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
        return res.status(403).json({ error: "Invalid or expired refresh token" });
    }

    const dbToken = await prisma.refreshToken.findFirst({
        where: {
        userId: decoded.userId,
        token: refreshToken,
        },
    });

    if (!dbToken) {
        return res
        .status(403)
        .json({ error: "Refresh token not found or has been revoked" });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
        return res.status(404).json({ error: "User associated with token not found" });
    }

    const newAccessToken = signAccessToken({ userId: user.id, role: user.role });

    res.json({ success: true, data: { accessToken: newAccessToken } });
};

export const logout = async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ error: "Refresh token is required" });
    }

    try {
        await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
        });
        res.json({ success: true, message: "Logged out successfully" });
    } catch (error) {
        logger.error("Logout error:", error);
        Sentry.captureException(error);
        res.json({ success: true, message: "Logged out" });
    }
};