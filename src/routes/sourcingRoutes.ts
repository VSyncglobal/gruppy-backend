// src/routes/sourcingRoutes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { validate } from "../middleware/validate";
import {
  createSourcingRequest,
  estimateLandedCost,
  getAllSourcingRequests,
  updateSourcingRequest,
} from "../controllers/sourcingController";
import {
  createSourcingRequestSchema,
  estimateLandedCostSchema,
  updateSourcingRequestSchema,
} from "../schemas/sourcingSchemas";

const router = Router();

// --- User-facing ---

/**
 * This is your "Request a Product" button.
 * POST /api/sourcing-requests
 */
router.post(
  "/",
  authenticate,
  validate(createSourcingRequestSchema),
  createSourcingRequest
);

/**
 * This is your new "Landed Cost Estimator".
 * POST /api/sourcing-requests/estimate
 */
router.post(
  "/estimate",
  authenticate,
  validate(estimateLandedCostSchema),
  estimateLandedCost
);

// --- Admin-facing ---

/**
 * Gets the admin's "to-do" list of requests.
 * GET /api/sourcing-requests/admin
 */
router.get(
  "/admin", 
  authenticate, 
  requireAdmin, 
  getAllSourcingRequests
);

/**
 * Lets the admin update a request with their research.
 * PUT /api/sourcing-requests/admin/:id
 */
router.put(
  "/admin/:id",
  authenticate,
  requireAdmin,
  validate(updateSourcingRequestSchema),
  updateSourcingRequest
);

export default router;