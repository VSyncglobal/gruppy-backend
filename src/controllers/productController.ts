import { Request, Response } from "express";
import prisma from "../utils/prismaClient";

// ✅ CREATE a new Product
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
    console.error("Error creating product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ✅ GET all Products
export const getAllProducts = async (req: Request, res: Response) => {
    try {
        const products = await prisma.product.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, data: products });
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// You can add update and delete functions here later following the same pattern