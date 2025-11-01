// src/routes/adminLogisticsRoutes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { validate } from "../middleware/validate";
import { logisticsRouteSchema } from "../schemas/adminSchemas";
import {
  createLogisticsRoute,
  getAllLogisticsRoutes,
  getLogisticsRouteById,
  updateLogisticsRoute,
  deleteLogisticsRoute,
} from "../controllers/logisticsController";

const router = Router();

// Protect all routes
router.use(authenticate, requireAdmin);

// POST /api/admin/logistics-routes
router.post("/", validate(logisticsRouteSchema), createLogisticsRoute);

// GET /api/admin/logistics-routes
router.get("/", getAllLogisticsRoutes);

// GET /api/admin/logistics-routes/:id
router.get("/:id", getLogisticsRouteById);

// PUT /api/admin/logistics-routes/:id
router.put("/:id", validate(logisticsRouteSchema), updateLogisticsRoute);

// DELETE /api/admin/logistics-routes/:id
router.delete("/:id", deleteLogisticsRoute);

export default router;