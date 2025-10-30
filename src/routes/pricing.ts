// src/routes/pricing.ts
import { Router } from "express";
// ✅ FIXED: Renamed import from 'calculatePricing'
import { calculatePriceHandler, getPricingLogs } from "../controllers/pricingcontroller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { calculatePriceSchema } from "../schemas/pricingSchemas";

const router = Router();

router.post(
  "/calculate",
  authenticate, // User must be logged in to use calculator
  validate(calculatePriceSchema),
  calculatePriceHandler // ✅ FIXED: Use the correct handler name
);

router.get(
  "/logs",
  authenticate,
  getPricingLogs
);

export default router;