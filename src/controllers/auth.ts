import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../utils/prismaClient";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";

// The register function remains unchanged as it is already aligned with the blueprint
export const register = async (req: Request, res: Response) => {
  try {
    let { name, email, password, role } = req.body;

    if (!email || !password || !name) {
      return res
        .status(400)
        .json({ error: "Name, email and password are required" });
    }
    email = email.toLowerCase();
    const passwordPolicy =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordPolicy.test(password)) {
      return res.status(400).json({
        error:
          "Password must be at least 8 characters long, include upper and lowercase letters, a number, and a special character.",
      });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: "Email already in use" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password_hash: hashedPassword,
        role: role || "CONSUMER",
      },
    });
    res.json({ success: true, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// The login function is updated to issue both tokens
export const login = async (req: Request, res: Response) => {
  try {
    let { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    email = email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // ✅ Generate BOTH tokens
    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id });

    // 🗓️ Calculate expiry date for the refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Set expiry for 7 days from now

    // 💾 Store the refresh token in the database
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken, // For simplicity. In a high-security app, you might hash this.
        expiresAt,
      },
    });

    // ✅ Return both tokens to the client
    res.json({ success: true, data: { accessToken, refreshToken } });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ✨ NEW: Controller for refreshing the access token
export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ error: "Refresh token is required" });
  }

  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    return res.status(403).json({ error: "Invalid or expired refresh token" });
  }

  // 🛡️ Verify the token exists in our database (it hasn't been revoked/logged out)
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

  // Fetch the user to get their role for the new access token payload
  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user) {
    return res.status(404).json({ error: "User associated with token not found" });
  }

  // ✅ Issue a new access token
  const newAccessToken = signAccessToken({ userId: user.id, role: user.role });

  res.json({ success: true, data: { accessToken: newAccessToken } });
};

// ✨ NEW: Controller for logging out and invalidating the refresh token
export const logout = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: "Refresh token is required" });
  }

  try {
    // 🗑️ Delete the refresh token from the database to invalidate it
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    // Fails silently if token doesn't exist, which is acceptable for logout
    console.error("Logout error:", error);
    res.json({ success: true, message: "Logged out" });
  }
};