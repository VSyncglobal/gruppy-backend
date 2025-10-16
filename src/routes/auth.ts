import { Router } from "express";
import { register, login, refresh, logout } from "../controllers/auth"; // Import the new functions
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate"; // ✨ IMPORT aLIDATE
import { registerSchema } from "../schemas/authSchemas"; // ✨ IMPORT aLIDATION sCHEMA
import { loginSchema } from "../schemas/authSchemas"; 

const router = Router();
// ✨ APPLY the middleware. The request will be validated against the schema
// before it ever reaches the 'register' controller.
router.post("/register", validate(registerSchema), register);

// --- Public Routes ---
router.post("/login", validate(loginSchema), login); 

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