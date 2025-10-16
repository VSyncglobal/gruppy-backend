import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

export const createProduct = async (req: Request, res: Response) => {
  try {
    const { name, hsCode, basePrice } = req.body;

    const product = await prisma.product.create({
      data: {
        name,
        hsCode,
        basePrice: parseFloat(basePrice),
      },
    });

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    logger.error("Error creating product:", error);
    Sentry.captureException(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getAllProducts = async (req: Request, res: Response) => {
    try {
        const products = await prisma.product.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, data: products });
    } catch (error) {
        logger.error("Error fetching products:", error);
        Sentry.captureException(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};