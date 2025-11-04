// src/controllers/auth.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../utils/prismaClient';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { loginSchema, registerSchema } from '../schemas/authSchemas';
import logger from '../utils/logger';
import * as Sentry from '@sentry/node';

import { generateVerificationToken, generateNumericCode, hashToken } from '../utils/token';
import mailService from '../services/mailService'; // <-- Fixed default import
import crypto from 'crypto';

const REFRESH_TOKEN_COOKIE_NAME = 'jid';

const sendRefreshToken = (res: Response, token: string) => {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/api/auth/refresh',
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });
};

/**
 * Handles user registration AND sends verification email
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = registerSchema.parse(req).body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const verificationToken = generateVerificationToken();

    const user = await prisma.user.create({
      data: { 
        name, 
        email, 
        password_hash: hashedPassword, 
        role,
        emailVerificationToken: verificationToken,
        emailVerified: false, // Explicitly set to false on creation
      },
    });

    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/verify-email?token=${verificationToken}`;
    await mailService.sendEmail({
      to: user.email,
      subject: "Welcome to Gruppy! Please verify your email.",
      text: `Thanks for signing up! Please click the link to verify your email: ${verificationUrl} \n\nYour token is: ${verificationToken}`,
    });

    // ✅ --- START OF FIX (Line 60 area) ---
    // We must pass the emailVerified status to the token
    const accessToken = signAccessToken({ 
      userId: user.id, 
      role: user.role, 
      emailVerified: user.emailVerified // <-- ADDED THIS
    });
    // ✅ --- END OF FIX ---

    const refreshToken = signRefreshToken({ userId: user.id });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

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

    return res.status(201).json({
      success: true,
      message: "Registration successful. Please check your email to verify your account.",
      data: {
        accessToken,
        refreshToken, 
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
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
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req).body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ success: false, error: 'Invalid credentials' });
    }

    // ✅ --- START OF FIX (Line 137 area) ---
    // We must pass the emailVerified status to the token
    const accessToken = signAccessToken({ 
      userId: user.id, 
      role: user.role,
      emailVerified: user.emailVerified // <-- ADDED THIS
    });
    // ✅ --- END OF FIX ---

    const refreshToken = signRefreshToken({ userId: user.id });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

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
          emailVerified: user.emailVerified,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
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
 * Handles refreshing the access token.
 */
export const refresh = async (req: Request, res: Response) => {
  const token = req.cookies[REFRESH_TOKEN_COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ success: false, error: 'No refresh token' });
  }

  try {
    // We get the refresh token from the DB
    const dbToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: { select: { id: true, role: true, emailVerified: true } } },
    });

    if (!dbToken || dbToken.expiresAt < new Date()) {
      return res
        .status(401)
        .json({ success: false, error: 'Invalid or expired refresh token' });
    }

    // We issue a new access token *with* the user's verification status
    const newAccessToken = signAccessToken({ 
      userId: dbToken.user.id, 
      role: dbToken.user.role,
      emailVerified: dbToken.user.emailVerified,
    });
    return res.json({ success: true, data: { accessToken: newAccessToken } });
  } catch (error) {
    logger.error('Refresh token error:', { error });
    Sentry.captureException(error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

/**
 * Handles user logout.
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


// --- NEW FUNCTION: Verify Email ---
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    const user = await prisma.user.findUnique({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired verification token." });
    }

    if (user.emailVerified) {
      return res.status(400).json({ success: false, message: "Email is already verified." });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null, // Invalidate the token
      },
    });

    return res.status(200).json({ success: true, message: "Email verified successfully. You can now log in." });

  } catch (error) {
    logger.error('Email verification error:', { error });
    Sentry.captureException(error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// --- NEW FUNCTION: Forgot Password ---
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const resetCode = generateNumericCode(6);
      const { hashedToken, expiresAt } = hashToken(resetCode);

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: hashedToken,
          expiresAt: expiresAt,
        }
      });

      await mailService.sendEmail({
        to: user.email,
        subject: "Your Gruppy Password Reset Code",
        text: `You requested a password reset. Your 6-digit code is: ${resetCode} \n\nThis code will expire in 1 hour.`,
      });
    }

    return res.status(200).json({ success: true, message: "If an account with that email exists, a password reset code has been sent." });

  } catch (error) {
    logger.error('Forgot password error:', { error });
    Sentry.captureException(error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


// --- NEW FUNCTION: Reset Password ---
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: hashedToken },
    });

    if (!resetToken) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset code." });
    }

    if (resetToken.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });
      return res.status(400).json({ success: false, message: "Invalid or expired reset code." });
    }

    const newHashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password_hash: newHashedPassword },
      }),
      prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      })
    ]);

    return res.status(200).json({ success: true, message: "Password reset successful. You can now log in." });

  } catch (error) {
    logger.error('Reset password error:', { error });
    Sentry.captureException(error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};