// src/routes/pricing.ts
import { Router } from "express";
import { calculatePriceHandler, getPricingLogs } from "../controllers/pricingcontroller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { calculatePriceSchema } from "../schemas/pricingSchemas";

const router = Router();

/*
// --- MODIFIED: This route is temporarily disabled as its logic is obsolete ---
router.post(
  "/calculate",
  authenticate, 
  validate(calculatePriceSchema),
  calculatePriceHandler 
);
*/

router.get(
  "/logs",
  authenticate,
  getPricingLogs
);

export default router;