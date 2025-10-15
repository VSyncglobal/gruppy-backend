import { Router } from "express";
import { register, login, refresh, logout } from "../controllers/auth"; // Import the new functions
import { authenticate } from "../middleware/auth";

const router = Router();

// --- Public Routes ---
router.post("/register", register);
router.post("/login", login);

// --- New Routes for Token Management ---
router.post("/refresh", refresh);
router.post("/logout", logout); // No authentication middleware needed here

// --- Protected Routes ---
// This route is for testing if an access token is valid
router.get("/me", authenticate, (req, res) => {
  res.json({
    success: true,
    message: "Protected route accessed successfully!",
    user: (req as any).user,
  });
});

export default router;