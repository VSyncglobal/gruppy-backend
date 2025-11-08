// src/routes/deliveryRoutes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { getDeliveryQuoteSchema } from "../schemas/deliverySchemas";
import { getDeliveryQuote } from "../controllers/deliveryController";

const router = Router();

/**
 * @route POST /api/delivery/quote
 * @description Authenticated route to get a delivery cost estimate.
 */
router.post(
  "/quote",
  authenticate,
  validate(getDeliveryQuoteSchema),
  getDeliveryQuote
);

export default router;