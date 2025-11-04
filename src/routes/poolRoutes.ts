// src/routes/poolRoutes.ts
import { Router } from "express";
import {
  getAllPools,
  getAllPoolsAdmin,
  getPoolById,
  joinPool,
  createPool,
  updatePool,
  deletePool,
  adminUpdatePoolStatus,
} from "../controllers/poolController";
import { calculatePoolPricing } from "../controllers/adminPoolController";

import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createPoolSchema,
  updatePoolSchema,
  joinPoolSchema,
  adminUpdatePoolStatusSchema,
  calculatePoolPricingSchema,
} from "../schemas/poolSchemas";
import { requireAdmin } from "../middleware/admin";

// ✅ --- NEW IMPORT ---
import { requireVerified } from "../middleware/requireVerified";
// ✅ --- END NEW IMPORT ---

const router = Router();

// --- Public routes ---
router.get("/", getAllPools);
router.get("/:id", getPoolById);

// --- Authenticated user routes ---
router.post(
  "/:id/join",
  authenticate,     // 1. Must be logged in
  requireVerified,  // 2. ✅ MUST be verified
  validate(joinPoolSchema),
  joinPool
);

// --- Admin routes ---
router.post(
  "/admin/calculate-pricing",
  authenticate,
  requireAdmin,
  validate(calculatePoolPricingSchema),
  calculatePoolPricing
);

router.get("/admin/all", authenticate, requireAdmin, getAllPoolsAdmin);

router.post(
  "/",
  authenticate,
  requireAdmin,
  validate(createPoolSchema),
  createPool
);
router.put(
  "/:id",
  authenticate,
  requireAdmin,
  validate(updatePoolSchema),
  updatePool
);
router.delete("/:id", authenticate, requireAdmin, deletePool);
router.patch(
  "/:id/status",
  authenticate,
  requireAdmin,
  validate(adminUpdatePoolStatusSchema),
  adminUpdatePoolStatus
);

export default router;