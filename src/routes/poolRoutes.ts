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
import { 
  calculatePoolPricing,
  runPoolSimulations, // --- NEW (v2.1 Engine) ---
} from "../controllers/adminPoolController";

import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createPoolSchema,
  updatePoolSchema,
  joinPoolSchema,
  adminUpdatePoolStatusSchema,
  calculatePoolPricingSchema,
  runSimulationSchema, // --- NEW (v2.1 Engine) ---
} from "../schemas/poolSchemas";
import { requireAdmin } from "../middleware/admin";
import { requireVerified } from "../middleware/requireVerified";

const router = Router();

// --- Public routes ---
router.get("/", getAllPools);
router.get("/:id", getPoolById);

// --- Authenticated user routes ---
router.post(
  "/:id/join",
  authenticate,
  requireVerified,
  validate(joinPoolSchema),
  joinPool
);

// --- Admin routes ---

// The "single run" calculator
router.post(
  "/admin/calculate-pricing",
  authenticate,
  requireAdmin,
  validate(calculatePoolPricingSchema),
  calculatePoolPricing
);

// --- NEW (v2.1 Engine) ---
// The "parallel simulation" calculator (Section 8)
router.post(
  "/admin/run-simulation",
  authenticate,
  requireAdmin,
  validate(runSimulationSchema),
  runPoolSimulations
);
// --- END NEW ---

router.get("/admin/all", authenticate, requireAdmin, getAllPoolsAdmin);

// The "dumb" creator
router.post(
  "/", // This is POST /api/pools
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
  "/:id/status", // --- NOTE: Changed from PUT to PATCH for semantics ---
  authenticate,
  requireAdmin,
  validate(adminUpdatePoolStatusSchema),
  adminUpdatePoolStatus
);

export default router;