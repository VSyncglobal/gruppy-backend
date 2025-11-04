// src/controllers/reviewController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

// --- ✅ MODIFIED: createReview (Checks for duplicates) ---
export const createReview = async (req: Request, res: Response) => {
  try {
    const { rating, comment, productId, poolId } = req.body;
    const userId = (req as any).user.id;

    if (!productId && !poolId) {
      return res.status(400).json({
        success: false,
        message: "Review must be linked to a productId or poolId.",
      });
    }

    if (productId && poolId) {
      return res.status(400).json({
        success: false,
        message: "Review cannot be linked to both a product and a pool.",
      });
    }

    // --- ✅ CORRECTED DUPLICATE CHECK LOGIC ---
    const whereCondition: any = {
      userId: userId,
      parentId: null,
    };

    if (productId) {
      whereCondition.productId = productId;
    } else {
      whereCondition.poolId = poolId;
    }

    const existingReview = await prisma.review.findFirst({
      where: whereCondition,
    });
    // --- ✅ END OF FIX ---

    if (existingReview) {
      return res.status(409).json({
        success: false,
        message: "You have already submitted a review for this item.",
        reviewId: existingReview.id, // Help frontend redirect to update
      });
    }

    const review = await prisma.review.create({
      data: {
        rating,
        comment,
        userId,
        productId,
        poolId,
        // parentId is null by default
      },
    });

    res.status(201).json({ success: true, data: review });
  } catch (error: any)
 {
    logger.error("Error creating review:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Product or Pool not found" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- ✅ MODIFIED: getAllReviews (includes counts) ---
export const getAllReviews = async (req: Request, res: Response) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { parentId: null }, // Only get top-level reviews
      include: {
        user: { select: { name: true, email: true } },
        product: { select: { name: true } },
        pool: { select: { title: true } },
        _count: { select: { likes: true, replies: true } }, // Count likes and replies
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ success: true, data: reviews });
  } catch (error: any) {
    logger.error("Error fetching all reviews:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- ✅ MODIFIED: getProductReviews (fetches threads) ---
export const getProductReviews = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const reviews = await prisma.review.findMany({
      where: { 
        productId,
        parentId: null, // Only get top-level reviews for this product
      },
      include: {
        user: { select: { name: true } },
        _count: { select: { likes: true } }, // Count likes on the parent review
        // Get all replies for this review
        replies: {
          include: {
            user: { select: { name: true, role: true } }, // Show who replied
            _count: { select: { likes: true } }, // Show likes on the replies
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ success: true, data: reviews });
  } catch (error: any) {
    logger.error("Error fetching product reviews:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- ✅ MODIFIED: getPoolReviews (fetches threads) ---
export const getPoolReviews = async (req: Request, res: Response) => {
  try {
    const { poolId } = req.params;
    const reviews = await prisma.review.findMany({
      where: { 
        poolId,
        parentId: null, // Only get top-level reviews for this pool
      },
      include: {
        user: { select: { name: true } },
        _count: { select: { likes: true } },
        replies: {
          include: {
            user: { select: { name: true, role: true } },
            _count: { select: { likes: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ success: true, data: reviews });
  } catch (error: any) {
    logger.error("Error fetching pool reviews:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- (updateReview is unchanged) ---
export const updateReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const user = (req as any).user;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }
    if (review.userId !== user.id && user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const updatedReview = await prisma.review.update({
      where: { id },
      data: { rating, comment },
    });
    res.status(200).json({ success: true, data: updatedReview });
  } catch (error: any) {
    logger.error("Error updating review:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- ✅ MODIFIED: deleteReview (Fixed the typo) ---
export const deleteReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      // ✅ --- THIS IS THE FIX --- ✅
      return res.status(404).json({ success: false, message: "Review not found" });
      // ✅ --- END OF FIX --- ✅
    }
    if (review.userId !== user.id && user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    await prisma.review.delete({ where: { id } });
    res.status(204).send();
  } catch (error: any) {
    logger.error("Error deleting review:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- (replyToReview is unchanged) ---
export const replyToReview = async (req: Request, res: Response) => {
  try {
    const { id: parentId } = req.params; // The ID of the review we're replying to
    const { comment } = req.body;
    const userId = (req as any).user.id;

    const parentReview = await prisma.review.findUnique({
      where: { id: parentId },
    });

    if (!parentReview) {
      return res.status(404).json({ success: false, message: "Parent review not found." });
    }
    if (parentReview.parentId) {
      return res.status(400).json({ success: false, message: "You can only reply to top-level reviews." });
    }

    const reply = await prisma.review.create({
      data: {
        comment,
        rating: 0, // Replies don't have ratings
        userId,
        parentId: parentId, // Link it to the parent
      },
    });

    res.status(201).json({ success: true, data: reply });

  } catch (error: any) {
    logger.error("Error replying to review:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// --- (likeReview is unchanged) ---
export const likeReview = async (req: Request, res: Response) => {
  try {
    const { id: reviewId } = req.params; // id of the review
    const userId = (req as any).user.id;

    await prisma.reviewLike.upsert({
      where: {
        userId_reviewId: { userId, reviewId },
      },
      update: {}, // Do nothing if it exists
      create: { userId, reviewId },
    });

    res.status(201).json({ success: true, message: "Review liked" });
  } catch (error: any) {
    logger.error("Error liking review:", error);
    Sentry.captureException(error);
    if ((error as any).code === "P2025") {
      return res.status(404).json({ success: false, message: "Review not found" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- (unlikeReview is unchanged) ---
export const unlikeReview = async (req: Request, res: Response) => {
  try {
    const { id: reviewId } = req.params; // id of the review
    const userId = (req as any).user.id;

    await prisma.reviewLike.delete({
      where: {
        userId_reviewId: { userId, reviewId },
      },
    });

    res.status(200).json({ success: true, message: "Review unliked" });
  } catch (error: any) {
    logger.error("Error unliking review:", error);
    Sentry.captureException(error);
    if ((error as any).code === "P2025") {
      return res.status(404).json({ success: false, message: "Like not found" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};