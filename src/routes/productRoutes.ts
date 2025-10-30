import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { createProduct, getAllProducts } from "../controllers/productController";
import { validate } from "../middleware/validate";
import { createProductSchema } from "../schemas/productSchemas";

const router = Router();

// All product management routes require an admin user
router.use(authenticate, requireAdmin);

// POST /api/products
router.post("/", validate(createProductSchema), createProduct);
// GET /api/products
router.get("/", getAllProducts);

export default router;