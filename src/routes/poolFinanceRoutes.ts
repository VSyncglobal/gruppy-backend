import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { UserRole } from "@prisma/client";
import prisma from "../utils/prismaClient";

const router = Router();

// Admin-only pool finance view
router.get("/", authenticate, async (req, res) => {
  const role = (req as any).user?.role;
  if (role !== UserRole.ADMIN)
    return res.status(403).json({ error: "Access denied" });

  const finances = await prisma.poolFinance.findMany({
    include: {
      pool: { select: { id: true, title: true, status: true, currentQuantity: true, targetQuantity: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({ success: true, data: finances });
});

export default router;
