// src/routes/userRoutes.ts
import { Router } from "express";
import {
  getUserProfile,
  updateUserProfile,
  getMyPools, // <-- NEW
  getUserDashboardStats, // <-- NEW
} from "../controllers/userController";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
// ✅ NEW: Import the schema we just added
import { updateUserSchema } from "../schemas/authSchemas";

const router = Router();

// --- Authenticated User Routes ---
router.get("/profile", authenticate, getUserProfile);

router.put(
  "/profile",
  authenticate,
  validate(updateUserSchema), // ✅ This will now work
  updateUserProfile
);

// ✅ --- NEW DASHBOARD ROUTES --- ✅
router.get(
  "/my-pools", 
  authenticate, 
  getMyPools
);

router.get(
  "/dashboard-stats", 
  authenticate, 
  getUserDashboardStats
);

export default router;