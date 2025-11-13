// src/routes/adminBulkOrderRoutes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { validate } from "../middleware/validate";
import { updateBulkOrderSchema } from "../schemas/adminBulkOrderSchemas";
import {
  getAllBulkOrders,
  getBulkOrderById,
  updateBulkOrder,
  deleteBulkOrder,
} from "../controllers/adminBulkOrderController";

const router = Router();

// Protect all routes in this file
router.use(authenticate, requireAdmin);

// GET /api/admin/bulk-orders
router.get("/", getAllBulkOrders);

// GET /api/admin/bulk-orders/:id
router.get("/:id", getBulkOrderById);

// PUT /api/admin/bulk-orders/:id
router.put("/:id", validate(updateBulkOrderSchema), updateBulkOrder);

// DELETE /api/admin/bulk-orders/:id
router.delete("/:id", deleteBulkOrder);

export default router;