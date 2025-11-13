// src/routes/auth.ts
import { Router } from "express";
import { 
  register, 
  login, 
  refresh, 
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword
} from "../controllers/auth";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { 
  registerSchema, 
  loginSchema,
  emailVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from "../schemas/authSchemas";
// --- NEW (Fix 11): Import the authLimiter ---
import { authLimiter } from "../middleware/rateLimit";
// --- END MODIFICATION ---

const router = Router();

// --- Public Routes ---
// --- MODIFIED (Fix 11): Apply authLimiter to sensitive routes ---
router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", authLimiter, validate(loginSchema), login); 

// --- ✅ NEW AUTH FLOWS ---
router.post("/verify-email", validate(emailVerificationSchema), verifyEmail); // No limiter needed here (requires token)
router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), resetPassword);
// --- END MODIFICATION ---

// --- Token Management Routes ---
router.post("/refresh", refresh);
router.post("/logout", logout);

// --- Protected Test Route (Unchanged) ---
router.get("/me", authenticate, (req, res) => {
  res.json({
    success: true,
    message: "Protected route accessed successfully!",
    user: (req as any).user,
  });
});

export default router;