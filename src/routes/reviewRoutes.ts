// src/routes/reviewRoutes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { validate } from "../middleware/validate";
import {
  createReviewSchema,
  updateReviewSchema,
  replyToReviewSchema, // <-- ✅ NEW IMPORT
} from "../schemas/reviewSchemas";
import * as reviewController from "../controllers/reviewController";

const router = Router();

// --- Public Routes ---
// Get reviews (and their replies/likes) for a specific product
router.get("/product/:productId", reviewController.getProductReviews);

// Get reviews (and their replies/likes) for a specific pool
router.get("/pool/:poolId", reviewController.getPoolReviews);

// --- Authenticated User Routes ---
// Create a new TOP-LEVEL review
router.post(
  "/",
  authenticate,
  validate(createReviewSchema),
  reviewController.createReview
);

// Update or Delete YOUR OWN review
router.put(
  "/:id",
  authenticate,
  validate(updateReviewSchema),
  reviewController.updateReview
);
router.delete("/:id", authenticate, reviewController.deleteReview);

// --- ✅ NEW ROUTES FOR REPLIES & LIKES ---

// Reply to a top-level review
router.post(
  "/:id/reply",
  authenticate,
  validate(replyToReviewSchema),
  reviewController.replyToReview
);

// Like a review (or a reply)
router.post(
  "/:id/like",
  authenticate,
  reviewController.likeReview
);

// Unlike a review (or a reply)
router.delete(
  "/:id/like",
  authenticate,
  reviewController.unlikeReview
);

// --- Admin-Only Routes ---
// Get all reviews (for admin dashboard)
router.get("/all", authenticate, requireAdmin, reviewController.getAllReviews);

export default router;