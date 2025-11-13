// src/routes/deliveryRoutes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { getDeliveryQuoteSchema } from "../schemas/deliverySchemas";
import {
  getDeliveryQuote,
  // --- NEW (v_phase5): Import Admin functions ---
  getAllDeliveryRates,
  createDeliveryRate,
  updateDeliveryRate,
  deleteDeliveryRate,
} from "../controllers/deliveryController";
import { requireAdmin } from "../middleware/admin"; // --- NEW (v_phase5) ---
import {
  createDeliveryRateSchema,
  updateDeliveryRateSchema,
} from "../schemas/adminLogisticsSchemas"; // --- NEW (v_phase5) ---

const router = Router();

// --- Public User-Facing Route ---

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

// --- NEW (v_phase5): Admin Routes for Delivery Rate Management ---

// Create a sub-router for admin routes, secured by middleware
const adminRouter = Router();
adminRouter.use(authenticate, requireAdmin);

/**
 * @route GET /api/delivery/admin/rates
 * @description Admin: Get all delivery rates
 */
adminRouter.get("/rates", getAllDeliveryRates);

/**
 * @route POST /api/delivery/admin/rates
 * @description Admin: Create a new delivery rate
 */
adminRouter.post(
  "/rates",
  validate(createDeliveryRateSchema),
  createDeliveryRate
);

/**
 * @route PUT /api/delivery/admin/rates/:id
 * @description Admin: Update a delivery rate
 */
adminRouter.put(
  "/rates/:id",
  validate(updateDeliveryRateSchema),
  updateDeliveryRate
);

/**
 * @route DELETE /api/delivery/admin/rates/:id
 * @description Admin: Delete a delivery rate
 */
adminRouter.delete("/rates/:id", deleteDeliveryRate);

// Mount the admin router under the /admin path
// All routes will be prefixed with /api/delivery/admin
router.use("/admin", adminRouter);

export default router;