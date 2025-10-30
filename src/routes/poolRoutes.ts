// src/routes/poolRoutes.ts
import { Router } from "express";
import {
  getAllPools, // ✅ FIXED
  getAllPoolsAdmin, // ✅ FIXED
  getPoolById,
  joinPool,
  createPool,
  updatePool,
  deletePool,
  adminUpdatePoolStatus,
} from "../controllers/poolController";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createPoolSchema,
  updatePoolSchema,
  joinPoolSchema,
  adminUpdatePoolStatusSchema,
} from "../schemas/poolSchemas";
import { requireAdmin } from "../middleware/admin";

const router = Router();

// --- Public routes ---
// Gets all pools that are 'FILLING' and not past deadline
router.get("/", getAllPools); // ✅ FIXED
router.get("/:id", getPoolById);

// --- Authenticated user routes ---
router.post(
  "/:id/join",
  authenticate,
  validate(joinPoolSchema),
  joinPool
);

// --- Admin routes ---
// Gets ALL pools for the admin dashboard
router.get("/admin/all", authenticate, requireAdmin, getAllPoolsAdmin); // ✅ FIXED

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