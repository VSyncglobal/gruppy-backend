import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin"; // ✨ IMPORT THE ADMIN MIDDLEWARE
import {
  createPool,
  joinPool,
  getPools,
  getPoolById,
} from "../controllers/poolController";
import { validate } from "../middleware/validate"; // ✨ IMPORT
import { createPoolSchema, joinPoolSchema } from "../schemas/poolSchemas"; // ✨ IMPORT


const router = Router();

// ✨ APPLY VALIDATION
router.post("/", authenticate, requireAdmin, validate(createPoolSchema), createPool);
router.post("/join", authenticate, validate(joinPoolSchema), joinPool);

router.get("/", getPools);
router.get("/:id", getPoolById);

export default router;