import jwt from "jsonwebtoken";

// It's crucial to add REFRESH_SECRET to your .env file
const ACCESS_SECRET = process.env.JWT_SECRET || "default-access-secret";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "default-refresh-secret";

/**
 * Signs a short-lived Access Token.
 * @param payload - Must contain userId and role.
 */
export function signAccessToken(payload: { userId: string; role: string }) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: "15m" });
}

/**
 * Signs a long-lived Refresh Token.
 * @param payload - Should only contain userId.
 */
export function signRefreshToken(payload: { userId: string }) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: "7d" });
}

/**
 * Verifies an Access Token. Returns the decoded payload or null if invalid.
 * @param token - The Access Token to verify.
 */
export function verifyAccessToken(token: string) {
  try {
    return jwt.verify(token, ACCESS_SECRET) as { userId: string; role: string };
  } catch (error) {
    // Catches expired tokens or invalid signatures
    return null;
  }
}

/**
 * Verifies a Refresh Token. Returns the decoded payload or null if invalid.
 * @param token - The Refresh Token to verify.
 */
export function verifyRefreshToken(token: string) {
  try {
    return jwt.verify(token, REFRESH_SECRET) as { userId: string };
  } catch (error) {
    // Catches expired tokens or invalid signatures
    return null;
  }
}