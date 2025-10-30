// src/routes/adminPaymentRoutes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import {
  getAllPayments,
  getPaymentsForPool,
} from "../controllers/adminPaymentController";

const router = Router();

// --- Admin-Only Payment Routes ---

// All routes in this file are protected by admin middleware
router.use(authenticate, requireAdmin);

// Get all payments in the system (paginated)
router.get("/", getAllPayments);

// Get all payments for a single pool
router.get("/pool/:poolId", getPaymentsForPool);

export default router;