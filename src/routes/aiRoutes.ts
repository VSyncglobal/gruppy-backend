// src/routes/aiRoutes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { suggestHSCodeSchema } from "../schemas/aiSchemas";
import { suggestHSCodeHandler } from "../controllers/aiController";

const router = Router();

// This endpoint is for logged-in users (e.g., in the calculator)
router.post(
  "/suggest-hscode",
  authenticate,
  validate(suggestHSCodeSchema),
  suggestHSCodeHandler
);

export default router;