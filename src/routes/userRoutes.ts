import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getUserProfile } from "../controllers/userController";

const router = Router();

// ✅ Protected route to get logged-in user details
router.get("/me", authenticate, getUserProfile);

export default router; // ✅ this fixes your “no default export” error
