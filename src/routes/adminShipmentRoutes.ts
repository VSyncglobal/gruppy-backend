// src/routes/adminShipmentRoutes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { validate } from "../middleware/validate";
import {
  createShipmentSchema,
  updateShipmentStatusSchema,
  assignPoolToShipmentSchema,
  updateShipmentDetailsSchema, // --- 1. IMPORT THE NEW/EDIT SCHEMA ---
} from "../schemas/shipmentSchemas";
import {
  createShipment,
  getAllShipments,
  getShipmentById,
  addPoolToShipment,
  removePoolFromShipment,
  updateShipmentStatus,
  updateShipment, // --- 2. IMPORT THE NEW EDIT FUNCTION ---
  deleteShipment, // --- 3. IMPORT THE NEW DELETE FUNCTION ---
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

// --- 4. ADD THE NEW EDIT ROUTE ---
// PUT /api/admin/shipments/:id (For editing details)
router.put(
  "/:id",
  validate(updateShipmentDetailsSchema), // Use the new schema
  updateShipment
);

// PUT /api/admin/shipments/:id/status (For changing status)
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

// --- 5. ADD THE NEW DELETE ROUTE ---
// DELETE /api/admin/shipments/:id
router.delete("/:id", deleteShipment);
// --- END OF FIX ---

export default router;