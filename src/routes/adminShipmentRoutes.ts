// src/routes/adminShipmentRoutes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { validate } from "../middleware/validate";
import {
  createShipmentSchema,
  updateShipmentStatusSchema,
  assignPoolToShipmentSchema,
} from "../schemas/shipmentSchemas";
import {
  createShipment,
  getAllShipments,
  getShipmentById,
  addPoolToShipment,
  removePoolFromShipment,
  updateShipmentStatus,
} from "../controllers/adminShipmentController";

const router = Router();

// All routes are admin-only
router.use(authenticate, requireAdmin);

// POST /api/admin/shipments
router.post("/", validate(createShipmentSchema), createShipment);

// GET /api/admin/shipments
router.get("/", getAllShipments);

// GET /api/admin/shipments/:id
router.get("/:id", getShipmentById);

// PUT /api/admin/shipments/:id/status
router.put(
  "/:id/status",
  validate(updateShipmentStatusSchema),
  updateShipmentStatus
);

// POST /api/admin/shipments/:id/pools
router.post(
  "/:id/pools",
  validate(assignPoolToShipmentSchema),
  addPoolToShipment
);

// DELETE /api/admin/shipments/:id/pools/:poolId
router.delete("/:id/pools/:poolId", removePoolFromShipment);

export default router;