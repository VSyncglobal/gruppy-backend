// src/routes/adminUserRoutes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
// --- THIS IS THE FIX ---
// Import the new 'creditUserBalance' function
import { getAllUsers, promoteUserToAdmin, creditUserBalance } from "../controllers/adminController";
// --- END FIX ---
import { validate } from "../middleware/validate";
import { promoteUserSchema } from "../schemas/adminSchemas";
import { creditUserBalanceSchema } from "../schemas/adminUserSchemas";

const router = Router();

// Protect all routes in this file with both authentication and admin checks
router.use(authenticate, requireAdmin);

// GET /api/admin/users
router.get("/", getAllUsers);

// POST /api/admin/users/promote
router.post("/promote", validate(promoteUserSchema), promoteUserToAdmin);

// --- NEW (v1.3) ---
router.post(
  "/:id/credit-balance",
  validate(creditUserBalanceSchema),
  creditUserBalance
); // <-- THIS IS THE FIX (Added closing parenthesis and semicolon)

export default router;