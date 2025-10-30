// src/routes/categoryRoutes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin"; // ✅ FIXED
import { validate } from "../middleware/validate";
import {
  createCategorySchema,
  createSubcategorySchema,
  updateCategorySchema,
  updateSubcategorySchema,
} from "../schemas/categorySchemas";
import * as categoryController from "../controllers/categoryController";

const router = Router();

// --- Public Category Routes ---
router.get("/", categoryController.getAllCategories);
router.get("/subcategories", categoryController.getAllSubcategories);

// --- Admin-Only Category Routes ---
router.post(
  "/",
  authenticate,
  requireAdmin, // ✅ FIXED (correct function, no arguments)
  validate(createCategorySchema),
  categoryController.createCategory
);

router.put(
  "/:id",
  authenticate,
  requireAdmin, // ✅ FIXED
  validate(updateCategorySchema),
  categoryController.updateCategory
);

router.delete(
  "/:id",
  authenticate,
  requireAdmin, // ✅ FIXED
  categoryController.deleteCategory
);

// --- Admin-Only Subcategory Routes ---
router.post(
  "/subcategories",
  authenticate,
  requireAdmin, // ✅ FIXED
  validate(createSubcategorySchema),
  categoryController.createSubcategory
);

router.put(
  "/subcategories/:id",
  authenticate,
  requireAdmin, // ✅ FIXED
  validate(updateSubcategorySchema),
  categoryController.updateSubcategory
);

router.delete(
  "/subcategories/:id",
  authenticate,
  requireAdmin, // ✅ FIXED
  categoryController.deleteSubcategory
);

export default router;