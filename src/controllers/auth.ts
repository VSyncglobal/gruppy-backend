import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { signToken } from "../utils/jwt";

const prisma = new PrismaClient();

export async function register(req: Request, res: Response) {
  try {
    const { name, email, password, role } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || "CONSUMER",
      },
    });

    return res.status(201).json({ message: "User registered", userId: user.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Registration failed" });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken({ userId: user.id, role: user.role });

    return res.json({ token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Login failed" });
  }
}
