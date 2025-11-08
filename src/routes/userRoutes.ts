// src/routes/userRoutes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  changePasswordSchema,
} from "../schemas/authSchemas";
import {
  // --- NEW (v1.3) ---
  updateUserProfileSchema,
  changeEmailSchema,
  createAddressSchema,
  updateAddressSchema,
} from "../schemas/userSchemas"; // We created this file
import {
  getUserProfile,
  updateUserProfile,
  changeEmail,
  changePassword,
  getMyPools,
  getUserDashboardStats,
  // --- NEW (v1.3) Address CRUD ---
  getUserAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from "../controllers/userController";

const router = Router();

// All user routes are authenticated
router.use(authenticate);

// --- Profile Routes (v1.3) ---
// THIS IS THE ROUTE THAT IS FAILING
router.get("/profile", getUserProfile);

router.put(
  "/profile",
  validate(updateUserProfileSchema),
  updateUserProfile
);
router.post(
  "/profile/change-email",
  validate(changeEmailSchema),
  changeEmail
);

// --- Address Routes (v1.3) ---
router.get("/profile/addresses", getUserAddresses);
router.post(
  "/profile/addresses",
  validate(createAddressSchema),
  createAddress
);
router.put(
  "/profile/addresses/:addressId",
  validate(updateAddressSchema),
  updateAddress
);
router.delete(
  "/profile/addresses/:addressId",
  deleteAddress
);

// --- Pool/Stat Routes ---
router.get("/dashboard-stats", getUserDashboardStats);
router.get("/my-pools", getMyPools);

// --- Security Routes ---
router.post(
  "/change-password",
  validate(changePasswordSchema),
  changePassword
);

export default router;