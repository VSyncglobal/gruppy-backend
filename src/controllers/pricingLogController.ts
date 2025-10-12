import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import prisma from "../utils/prismaClient";

// 🧾 Admin: view all logs
export async function getAllLogs(req: AuthRequest, res: Response) {
  try {
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Access denied" });
    }

    const logs = await prisma.pricingLog.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, count: logs.length, data: logs });
  } catch (err: any) {
    console.error("Error fetching all logs:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// 👤 User: view only their own logs
export async function getUserLogs(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.id) {
  return res.status(401).json({ error: "Unauthorized" });
}

const logs = await prisma.priceCalculationLog.findMany({
  where: { userId: req.user.id },
});


    res.json({ success: true, count: logs.length, data: logs });
  } catch (err: any) {
    console.error("Error fetching user logs:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
