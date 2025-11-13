// src/routes/adminPaymentRoutes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import {
  getAllPayments,
  getPaymentsForPool,
  adminUpdatePaymentStatus, // --- NEW (v_phase6) ---
} from "../controllers/adminPaymentController";
import { validate } from "../middleware/validate"; // --- NEW (v_phase6) ---
import { adminUpdatePaymentStatusSchema } from "../schemas/paymentSchemas"; // --- NEW (v_phase6) ---

const router = Router();

// --- Admin-Only Payment Routes ---

// All routes in this file are protected by admin middleware
router.use(authenticate, requireAdmin);

// Get all payments in the system (paginated)
router.get("/", getAllPayments);

// Get all payments for a single pool
router.get("/pool/:poolId", getPaymentsForPool);

// --- NEW (v_phase6): Admin manual override for payment status ---
// PUT /api/admin/payments/:id/status
router.put(
  "/:id/status",
  validate(adminUpdatePaymentStatusSchema),
  adminUpdatePaymentStatus
);

export default router;