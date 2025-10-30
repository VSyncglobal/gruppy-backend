// src/controllers/reviewController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

// Create a new review
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

    // TODO: Add logic to prevent duplicate reviews
    // (e.g., check if user already reviewed this pool/product)

    const review = await prisma.review.create({
      data: {
        rating,
        comment,
        userId,
        productId,
        poolId,
      },
    });

    res.status(201).json({ success: true, data: review });
  } catch (error: any) {
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

// Get all reviews (e.g., for an admin dashboard)
export const getAllReviews = async (req: Request, res: Response) => {
  try {
    const reviews = await prisma.review.findMany({
      include: {
        user: { select: { name: true, email: true } },
        product: { select: { name: true } },
        pool: { select: { title: true } },
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

// Get reviews for a specific product
export const getProductReviews = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const reviews = await prisma.review.findMany({
      where: { productId },
      include: {
        user: { select: { name: true } },
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

// Get reviews for a specific pool
export const getPoolReviews = async (req: Request, res: Response) => {
  try {
    const { poolId } = req.params;
    const reviews = await prisma.review.findMany({
      where: { poolId },
      include: {
        user: { select: { name: true } },
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

// Update a review (only by owner or admin)
export const updateReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const user = (req as any).user;

    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    // Check permissions
    if (review.userId !== user.id && user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const updatedReview = await prisma.review.update({
      where: { id },
      data: {
        rating,
        comment,
      },
    });
    res.status(200).json({ success: true, data: updatedReview });
  } catch (error: any) {
    logger.error("Error updating review:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a review (only by owner or admin)
export const deleteReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    // Check permissions
    if (review.userId !== user.id && user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    await prisma.review.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error: any) {
    logger.error("Error deleting review:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};