// src/utils/jwt.ts
import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_SECRET || "default-access-secret";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "default-refresh-secret";

// ✅ --- START OF FIX ---
// The payload now includes emailVerified
export interface AccessTokenPayload {
  userId: string;
  role: string;
  emailVerified: boolean;
}
// ✅ --- END OF FIX ---

/**
 * Signs a short-lived Access Token.
 * @param payload - Must contain userId, role, and emailVerified status.
 */
export function signAccessToken(payload: AccessTokenPayload) { // ✅ FIX: Use new interface
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: "15m" });
}

/**
 * Signs a long-lived Refresh Token.
 */
export function signRefreshToken(payload: { userId: string }) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: "7d" });
}

/**
 * Verifies an Access Token. Returns the decoded payload or null if invalid.
 */
export function verifyAccessToken(token: string) {
  try {
    // ✅ FIX: Cast to the new interface
    return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Verifies a Refresh Token. Returns the decoded payload or null if invalid.
 */
export function verifyRefreshToken(token: string) {
  try {
    return jwt.verify(token, REFRESH_SECRET) as { userId: string };
  } catch (error) {
    return null;
  }
}