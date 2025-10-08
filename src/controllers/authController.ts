import { Request, Response } from "express";
import bcrypt from "bcrypt";
import prisma from "../utils/prismaClient";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const SALT_ROUNDS = 12;

export async function register(req: Request, res: Response) {
  try {
    let { name, email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Missing fields" });

    email = String(email).toLowerCase().trim();

    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({ error: "Password must be min 8 chars, include upper/lower/number/special" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: "Email already registered" });

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password_hash,
        role: role || undefined,
      }
    });

    return res.status(201).json({ success: true, userId: user.id });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Registration failed" });
  }
}

export async function login(req: Request, res: Response) {
  try {
    let { email, password } = req.body;
    email = String(email).toLowerCase().trim();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id });

    // store refresh token in DB (optional: or set httpOnly cookie)
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt }
    });

    return res.json({ accessToken, refreshToken });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Login failed" });
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: "Missing refresh token" });

    // check DB
    const tokenRow = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!tokenRow) return res.status(401).json({ error: "Invalid refresh token" });

    // verify token signature
    const payload = verifyRefreshToken(refreshToken) as any;
    const userId = payload.userId;
    if (!userId) return res.status(401).json({ error: "Invalid token payload" });

    // issue new pair
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(401).json({ error: "User not found" });

    const newAccess = signAccessToken({ userId: user.id, role: user.role });
    const newRefresh = signRefreshToken({ userId: user.id });

    // replace DB entry
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await prisma.refreshToken.create({
      data: { token: newRefresh, userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) }
    });

    return res.json({ accessToken: newAccess, refreshToken: newRefresh });
  } catch (err: any) {
    console.error(err);
    return res.status(401).json({ error: "Invalid refresh token" });
  }
}

export async function logout(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    return res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Logout failed" });
  }
}
