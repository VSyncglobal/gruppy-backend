// src/controllers/auth.ts (FIXED for your specific codebase)

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../utils/prismaClient';
// ✅ FIX 1: Use the correct function names from your jwt.ts
import { signAccessToken, signRefreshToken } from '../utils/jwt'; 
import { loginSchema, registerSchema } from '../schemas/authSchemas';
import logger from '../utils/logger';
import * as Sentry from '@sentry/node';

const REFRESH_TOKEN_COOKIE_NAME = 'jid';

/**
 * Creates a secure cookie for the refresh token.
 */
const sendRefreshToken = (res: Response, token: string) => {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/api/auth/refresh', // Only send cookie to refresh path
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });
};

/**
 * Handles user registration.
 * Creates a user, generates tokens, and sends them.
 */
export const register = async (req: Request, res: Response) => {
  try {
    // ✅ FIX 2: Destructure from the 'body' property of the parsed schema
    const { name, email, password, role } = registerSchema.parse(req).body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      // ✅ FIX 3: Use 'password_hash' to match your schema.prisma
      data: { name, email, password_hash: hashedPassword, role },
    });

    // ✅ FIX 1 & 2: Use the correct function names and include the 'role'
    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id });

    // Store the new refresh token in the database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: expiresAt,
      },
    });

    sendRefreshToken(res, refreshToken);

    // This response matches your frontend login/register page expectations
    return res.status(201).json({
      success: true,
      data: {
        accessToken,
        refreshToken, 
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      // ✅ FIX 5: Use 'error.issues' not 'error.errors'
      return res
        .status(400)
        .json({ success: false, error: 'Validation error', issues: error.issues });
    }
    if (
      error instanceof Error &&
      (error as any).code === 'P2002' &&
      (error as any).meta?.target?.includes('email')
    ) {
      return res
        .status(409)
        .json({ success: false, error: 'Email already in use' });
    }
    logger.error('Registration error:', { error });
    Sentry.captureException(error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

/**
 * Handles user login.
 * Verifies credentials, generates tokens, and sends them.
 */
export const login = async (req: Request, res: Response) => {
  try {
    // ✅ FIX 2: Destructure from the 'body' property of the parsed schema
    const { email, password } = loginSchema.parse(req).body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, error: 'Invalid credentials' });
    }

    // ✅ FIX 3: Compare with 'password_hash' from your schema.prisma
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ success: false, error: 'Invalid credentials' });
    }

    // ✅ FIX 1 & 2: Use the correct function names and include the 'role'
    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // ✅ FIX 4: This is the correct way to handle the token replacement crash.
    // The error showed 'token' is unique, so we upsert based on the *token* itself,
    // and provide the 'userId' as part of the data.
    // But even safer is to delete old ones and create the new one.
    await prisma.$transaction([
      prisma.refreshToken.deleteMany({
        where: { userId: user.id },
      }),
      prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: expiresAt,
        },
      }),
    ]);

    sendRefreshToken(res, refreshToken);

    // This response matches your frontend login/register page expectations
    return res.json({
      success: true,
      data: {
        accessToken,
        refreshToken, 
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      // ✅ FIX 5: Use 'error.issues' not 'error.errors'
      return res
        .status(400)
        .json({ success: false, error: 'Validation error', issues: error.issues });
    }
    logger.error('Login error:', { error });
    Sentry.captureException(error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

/**
 * Handles refreshing the access token using the refresh token.
 */
export const refresh = async (req: Request, res: Response) => {
  const token = req.cookies[REFRESH_TOKEN_COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ success: false, error: 'No refresh token' });
  }

  try {
    const dbToken = await prisma.refreshToken.findUnique({
      where: { token }, // This is correct, 'token' is the unique key
      include: { user: true },
    });

    if (!dbToken || dbToken.expiresAt < new Date()) {
      return res
        .status(401)
        .json({ success: false, error: 'Invalid or expired refresh token' });
    }

    // ✅ FIX 1 & 2: Use the correct function name and include the 'role'
    const newAccessToken = signAccessToken({ userId: dbToken.user.id, role: dbToken.user.role });
    return res.json({ success: true, data: { accessToken: newAccessToken } });
  } catch (error) {
    logger.error('Refresh token error:', { error });
    Sentry.captureException(error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

/**
 * Handles user logout.
 * Clears the refresh token cookie.
 */
export const logout = (_req: Request, res: Response) => {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/api/auth/refresh',
  });
  return res.json({ success: true, message: 'Logged out' });
};