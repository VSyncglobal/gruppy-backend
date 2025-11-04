// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../utils/prismaClient";
import { verifyAccessToken } from "../utils/jwt"; // ✅ FIX: Import our new verifier

// ✅ --- START OF FIX ---
// This interface now matches our AccessTokenPayload
export interface AuthRequest extends Request {
  user?: { 
    id: string; 
    role: string; 
    email: string;
    emailVerified: boolean; 
  };
}
// ✅ --- END OF FIX ---

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // ✅ FIX: Use our updated verifyAccessToken function
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }

    // We still check the DB to ensure the user hasn't been deleted
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, email: true, emailVerified: true }, // ✅ FIX: Select new field
    });

    if (!user) return res.status(401).json({ error: "User not found" });

    // ✅ FIX: Attach the full user payload (including emailVerified) to req.user
    // This is what our new `requireVerified` middleware will use.
    req.user = { 
      id: user.id, 
      role: user.role, 
      email: user.email, 
      emailVerified: user.emailVerified 
    };
    next();
  } catch (err) {
    console.error("Auth verification failed:", err);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}