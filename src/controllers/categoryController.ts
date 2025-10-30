// src/controllers/categoryController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";

// --- Category Controllers ---

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const category = await prisma.category.create({
      data: { name },
    });
    res.status(201).json({ success: true, data: category });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res
        .status(409)
        .json({ success: false, message: "Category name already exists" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllCategories = async (req: Request, res: Response) => {
  try {
    // Include subcategories and product counts for a rich frontend
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: { products: true, subcategories: true },
        },
        subcategories: true,
      },
      orderBy: { name: "asc" },
    });
    res.status(200).json({ success: true, data: categories });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const category = await prisma.category.update({
      where: { id },
      data: { name },
    });
    res.status(200).json({ success: true, data: category });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Note: Prisma will throw an error if subcategories or products are
    // still linked. This is a good safety measure.
    await prisma.category.delete({
      where: { id },
    });
    res.status(204).send(); // 204 No Content for successful deletion
  } catch (error: any) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }
    if (error.code === "P2003") {
      return res.status(409).json({
        success: false,
        message: "Cannot delete category, it is still linked to products or subcategories.",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- Subcategory Controllers ---

export const createSubcategory = async (req: Request, res: Response) => {
  try {
    const { name, categoryId } = req.body;
    const subcategory = await prisma.subcategory.create({
      data: { name, categoryId },
    });
    res.status(201).json({ success: true, data: subcategory });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Parent category not found" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllSubcategories = async (req: Request, res: Response) => {
  try {
    const subcategories = await prisma.subcategory.findMany({
      include: {
        category: { select: { name: true } },
        _count: { select: { products: true } },
      },
      orderBy: { name: "asc" },
    });
    res.status(200).json({ success: true, data: subcategories });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSubcategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, categoryId } = req.body;
    const subcategory = await prisma.subcategory.update({
      where: { id },
      data: { name, categoryId },
    });
    res.status(200).json({ success: true, data: subcategory });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Subcategory or new Category not found" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteSubcategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.subcategory.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error: any) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Subcategory not found" });
    }
     if (error.code === "P2003") {
      return res.status(409).json({
        success: false,
        message: "Cannot delete subcategory, it is still linked to products.",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};