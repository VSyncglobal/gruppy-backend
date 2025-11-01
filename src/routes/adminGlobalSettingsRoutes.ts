// src/routes/adminGlobalSettingsRoutes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { validate } from "../middleware/validate";
import { globalSettingSchema } from "../schemas/adminSchemas";
import {
  getAllSettings,
  createSetting,
  updateSetting,
  deleteSetting,
} from "../controllers/adminSettingsController";

const router = Router();

// Protect all routes
router.use(authenticate, requireAdmin);

// GET /api/admin/settings
router.get("/", getAllSettings);

// POST /api/admin/settings
router.post("/", validate(globalSettingSchema), createSetting);

// PUT /api/admin/settings/:key
router.put("/:key", validate(globalSettingSchema), updateSetting);

// DELETE /api/admin/settings/:key
router.delete("/:key", deleteSetting);

export default router;