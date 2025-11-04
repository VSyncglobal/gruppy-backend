// src/routes/userRoutes.ts
import { Router } from "express";
import {
  getUserProfile,
  updateUserProfile,
  getMyPools,
  getUserDashboardStats,
  changePassword, // <-- NEW
  updatePhone,    // <-- NEW
  updateAddress,  // <-- NEW
} from "../controllers/userController";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { 
  updateUserSchema,
  changePasswordSchema, // <-- NEW
  updatePhoneSchema,    // <-- NEW
  updateAddressSchema,  // <-- NEW
} from "../schemas/authSchemas";

const router = Router();

// --- Authenticated User Routes ---
router.get("/profile", authenticate, getUserProfile);

// ✅ --- NEW PROFILE MANAGEMENT ROUTES ---

// (Existing name/email update)
router.put(
  "/profile",
  authenticate,
  validate(updateUserSchema),
  updateUserProfile
);

router.post(
  "/profile/change-password",
  authenticate,
  validate(changePasswordSchema),
  changePassword
);

router.put(
  "/profile/phone",
  authenticate,
  validate(updatePhoneSchema),
  updatePhone
);

router.put(
  "/profile/address",
  authenticate,
  validate(updateAddressSchema),
  updateAddress
);

// ✅ --- END NEW PROFILE MANAGEMENT ROUTES ---

// --- DASHBOARD ROUTES ---
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