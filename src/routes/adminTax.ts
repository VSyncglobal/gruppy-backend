// src/routes/adminTax.ts
import { Router } from "express";
import {
  getTaxRates,
  addTaxRate,
  updateTaxRate,
  deleteTaxRate, // --- NEW (v_phase2): Import deleteTaxRate ---
} from "../controllers/taxController";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin"; // --- NEW (v_phase2): Import requireAdmin ---
import { validate } from "../middleware/validate";
import { kraRateSchema } from "../schemas/adminSchemas";

const router = Router();

// --- NEW (v_phase2): Protect all routes in this file ---
router.use(authenticate, requireAdmin);

router.get("/", getTaxRates);

// --- MODIFIED (v_phase2): 'authenticate' and 'requireAdmin' are now handled by router.use() ---
router.post("/", validate(kraRateSchema), addTaxRate);
router.put("/:id", validate(kraRateSchema), updateTaxRate);

// --- NEW (v_phase2): Add DELETE route ---
router.delete("/:id", deleteTaxRate);

export default router;