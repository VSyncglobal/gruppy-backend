import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { getAllUsers, promoteUserToAdmin } from "../controllers/adminController";
import { validate } from "../middleware/validate";
import { promoteUserSchema } from "../schemas/adminSchemas";

const router = Router();

// Protect all routes in this file with both authentication and admin checks
router.use(authenticate, requireAdmin);

// GET /api/admin/users
router.get("/", getAllUsers);

// POST /api/admin/users/promote
router.post("/promote", validate(promoteUserSchema), promoteUserToAdmin);

export default router;