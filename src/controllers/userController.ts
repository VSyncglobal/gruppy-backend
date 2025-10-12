import { Request, Response } from "express";
import prisma from "../utils/prismaClient";

export async function getUserProfile(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id; // pulled from token middleware
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ success: true, data: user });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
