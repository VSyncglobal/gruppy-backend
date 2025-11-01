// src/controllers/productController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

export const createProduct = async (req: Request, res: Response) => {
  try {
    const { 
      name, 
      hsCode, 
      basePrice, 
      benchmarkPrice, // --- NEW ---
      weightKg,     // --- NEW ---
      defaultRoute, // --- NEW ---
      subcategoryId // --- MODIFIED (Now required) ---
    } = req.body;

    // --- NEW: Find the parent category from the subcategory ---
    const subcategory = await prisma.subcategory.findUnique({
      where: { id: subcategoryId },
      select: { categoryId: true }
    });

    if (!subcategory) {
      return res.status(404).json({ success: false, message: "Subcategory not found" });
    }
    // --- End new logic ---

    const product = await prisma.product.create({
      data: {
        name,
        hsCode,
        basePrice: parseFloat(basePrice),
        benchmarkPrice: parseFloat(benchmarkPrice), // --- NEW ---
        weightKg: parseFloat(weightKg),         // --- NEW ---
        defaultRoute,                             // --- NEW ---
        subcategoryId,
        categoryId: subcategory.categoryId,       // --- NEW: Auto-link parent category ---
      },
    });

    res.status(201).json({ success: true, data: product });
  } catch (error: any) {
    logger.error("Error creating product:", error);
    Sentry.captureException(error);
    if (error.code === "P2002" && error.meta?.target?.includes("name")) {
      return res
        .status(409)
        .json({ success: false, message: "A product with this name already exists." });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: { select: { name: true } },
        subcategory: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: products });
  } catch (error) {
    logger.error("Error fetching products:", error);
    Sentry.captureException(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { name: true } },
        subcategory: { select: { name: true } },
        pools: {
          select: { id: true, title: true, status: true }
        }
      },
    });

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    logger.error("Error fetching product:", error);
    Sentry.captureException(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      hsCode, 
      basePrice, 
      benchmarkPrice,
      weightKg,
      defaultRoute,
      subcategoryId 
    } = req.body;

    let categoryId: string | undefined = undefined;

    // --- NEW: If subcategory is being changed, find its new parent ---
    if (subcategoryId) {
      const subcategory = await prisma.subcategory.findUnique({
        where: { id: subcategoryId },
        select: { categoryId: true }
      });

      if (!subcategory) {
        return res.status(404).json({ success: false, message: "Subcategory not found" });
      }
      categoryId = subcategory.categoryId;
    }
    // --- End new logic ---

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        hsCode,
        basePrice: basePrice ? parseFloat(basePrice) : undefined,
        benchmarkPrice: benchmarkPrice ? parseFloat(benchmarkPrice) : undefined,
        weightKg: weightKg ? parseFloat(weightKg) : undefined,
        defaultRoute,
        subcategoryId,
        categoryId, // --- NEW: Update parent category if subcategory changed ---
      },
    });
    res.status(200).json({ success: true, data: product });
  } catch (error: any) {
    logger.error("Error updating product:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.product.delete({
      where: { id },
    });
    res.status(204).send(); // No content
  } catch (error: any) {
    logger.error("Error deleting product:", error);
    Sentry.captureException(error);
     if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
     if (error.code === "P2003") {
      return res.status(409).json({
        success: false,
        message: "Cannot delete product, it is still linked to pools or orders.",
      });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};