// src/routes/adminAffiliateRoutes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import {
  createAffiliate,
  getAllAffiliates,
  updateAffiliate, // --- NEW (v_phase6) ---
  deleteAffiliate, // --- NEW (v_phase6) ---
} from "../controllers/adminController";
import { validate } from "../middleware/validate";
import {
  createAffiliateSchema,
  updateAffiliateSchema, // --- NEW (v_phase6) ---
} from "../schemas/adminSchemas";

const router = Router();

// Protect all routes in this file
router.use(authenticate, requireAdmin);

// POST /api/admin/affiliates
router.post("/", validate(createAffiliateSchema), createAffiliate);

// GET /api/admin/affiliates
router.get("/", getAllAffiliates);

// --- NEW (v_phase6): Add PUT and DELETE routes ---

// PUT /api/admin/affiliates/:id
router.put("/:id", validate(updateAffiliateSchema), updateAffiliate);

// DELETE /api/admin/affiliates/:id
router.delete("/:id", deleteAffiliate);

export default router;