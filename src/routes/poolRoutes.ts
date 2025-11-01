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
// --- NEW: Import the admin pool controller ---
import { calculatePoolPricing } from "../controllers/adminPoolController";

import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createPoolSchema,
  updatePoolSchema,
  joinPoolSchema,
  adminUpdatePoolStatusSchema,
  calculatePoolPricingSchema, // --- NEW: Import the new schema ---
} from "../schemas/poolSchemas";
import { requireAdmin } from "../middleware/admin";

const router = Router();

// --- Public routes ---
router.get("/", getAllPools);
router.get("/:id", getPoolById);

// --- Authenticated user routes ---
router.post(
  "/:id/join",
  authenticate,
  validate(joinPoolSchema),
  joinPool
);

// --- Admin routes ---
// --- NEW: Admin Pricing Helper ---
router.post(
  "/admin/calculate-pricing",
  authenticate,
  requireAdmin,
  validate(calculatePoolPricingSchema),
  calculatePoolPricing
);

// Gets ALL pools for the admin dashboard
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