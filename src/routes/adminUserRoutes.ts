// src/routes/adminUserRoutes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import {
  getAllUsers,
  promoteUserToAdmin,
  creditUserBalance,
  getUserById, // --- NEW (v_phase6) ---
  adminUpdateUser, // --- NEW (v_phase6) ---
  adminDeleteUser, // --- NEW (v_phase6) ---
} from "../controllers/adminController";
import { validate } from "../middleware/validate";
import { promoteUserSchema } from "../schemas/adminSchemas";
import {
  creditUserBalanceSchema,
  adminUpdateUserSchema, // --- NEW (v_phase6) ---
} from "../schemas/adminUserSchemas";

const router = Router();

// Protect all routes in this file with both authentication and admin checks
router.use(authenticate, requireAdmin);

// GET /api/admin/users
router.get("/", getAllUsers);

// --- NEW (v_phase6): Add GET /:id, PUT /:id, DELETE /:id ---

// GET /api/admin/users/:id
router.get("/:id", getUserById);

// PUT /api/admin/users/:id
router.put("/:id", validate(adminUpdateUserSchema), adminUpdateUser);

// DELETE /api/admin/users/:id
router.delete("/:id", adminDeleteUser);

// --- END NEW ROUTES ---

// POST /api/admin/users/promote
router.post("/promote", validate(promoteUserSchema), promoteUserToAdmin);

// POST /api/admin/users/:id/credit-balance
router.post(
  "/:id/credit-balance",
  validate(creditUserBalanceSchema),
  creditUserBalance
);

export default router;