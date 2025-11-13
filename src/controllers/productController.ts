// src/controllers/productController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";
import { Prisma } from "@prisma/client";

// Get all products (with filters)
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const { search, category, subcategory } = req.query;

    let where: Prisma.ProductWhereInput = {};

    if (search && typeof search === "string") {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { hsCode: { startsWith: search } },
      ];
    }

    if (category && typeof category === "string") {
      where.category = { name: { equals: category, mode: "insensitive" } };
    }

    if (subcategory && typeof subcategory === "string") {
      where.subcategory = {
        name: { equals: subcategory, mode: "insensitive" },
      };
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
        subcategory: { select: { name: true } },
        _count: { select: { pools: true, reviews: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ success: true, data: products });
  } catch (error: any) {
    logger.error("Error fetching all products:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get a single product
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUniqueOrThrow({
      where: { id },
      include: {
        category: { select: { name: true } },
        subcategory: { select: { name: true } },
        reviews: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
    });
    res.status(200).json({ success: true, data: product });
  } catch (error: any) {
    logger.error("Error fetching product by id:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Create a new product
export const createProduct = async (req: Request, res: Response) => {
  try {
    const {
      name,
      hsCode,
      basePrice,
      benchmarkPrice,
      weightKg,
      volumeCBM, // --- THIS IS THE FIX ---
      defaultRoute,
      categoryId,
      subcategoryId,
    } = req.body;

    // Check if category and subcategory are valid
    const subcategory = await prisma.subcategory.findUniqueOrThrow({
      where: { id: subcategoryId },
    });
    if (subcategory.categoryId !== categoryId) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Subcategory does not belong to the specified category.",
        });
    }

    const product = await prisma.product.create({
      data: {
        name,
        hsCode,
        basePrice,
        benchmarkPrice,
        weightKg,
        volumeCBM, // --- THIS IS THE FIX ---
        defaultRoute,
        categoryId,
        subcategoryId,
      },
    });
    res.status(201).json({ success: true, data: product });
  } catch (error: any) {
    logger.error("Error creating product:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({
          success: false,
          message: "Category or Subcategory not found.",
        });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Update a product
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      hsCode,
      basePrice,
      benchmarkPrice,
      weightKg,
      volumeCBM, // --- THIS IS THE FIX ---
      defaultRoute,
      categoryId,
      subcategoryId,
    } = req.body;

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        hsCode,
        basePrice,
        benchmarkPrice,
        weightKg,
        volumeCBM, // --- THIS IS THE FIX ---
        defaultRoute,
        categoryId,
        subcategoryId,
      },
    });
    res.status(200).json({ success: true, data: product });
  } catch (error: any) {
    logger.error("Error updating product:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({
          success: false,
          message: "Product, Category, or Subcategory not found",
        });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Delete a product
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.product.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error: any) {
    logger.error("Error deleting product:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    if (error.code === "P2003") {
      // Foreign key constraint failed
      return res
        .status(409)
        .json({
          success: false,
          message:
            "Cannot delete product. It is still linked to existing pools or reviews.",
        });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};