// src/middleware/requireVerified.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth"; // Import the AuthRequest type

export function requireVerified(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const user = req.user;

  if (!user) {
    // This should technically be caught by `authenticate` first, but good to be safe
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Admins are always allowed to bypass this check
  if (user.role === "ADMIN") {
    return next();
  }

  // Check the emailVerified status we added to req.user in auth.ts
  if (!user.emailVerified) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Please verify your email address to perform this action.",
      code: "EMAIL_NOT_VERIFIED",
    });
  }
  
  // If we're here, user is verified
  next();
}