// src/routes/productRoutes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import {
  createProduct,
  getAllProducts,
  getProductById,    // --- NEWLY IMPORTED ---
  updateProduct,    // --- NEWLY IMPORTED ---
  deleteProduct,    // --- NEWLY IMPORTED ---
} from "../controllers/productController";
import { validate } from "../middleware/validate";
import { createProductSchema, updateProductSchema } from "../schemas/productSchemas"; // --- IMPORTED updateProductSchema ---

const router = Router();

// --- Public routes (if you want any, add them here) ---
// e.g., router.get("/", getAllProducts);
// e.g., router.get("/:id", getProductById);


// --- Admin-Only Routes ---
// All product management routes require an admin user
router.use(authenticate, requireAdmin);

// POST /api/products
router.post("/", validate(createProductSchema), createProduct);

// GET /api/products (Admin-only get all)
router.get("/", getAllProducts);

// --- NEWLY ADDED ROUTES ---

// GET /api/products/:id (Admin-only get one)
router.get("/:id", getProductById);

// PUT /api/products/:id
router.put("/:id", validate(updateProductSchema), updateProduct);

// DELETE /api/products/:id
router.delete("/:id", deleteProduct);

export default router;