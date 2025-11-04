// src/routes/auth.ts
import { Router } from "express";
import { 
  register, 
  login, 
  refresh, 
  logout,
  verifyEmail,      // <-- NEW
  forgotPassword,   // <-- NEW
  resetPassword     // <-- NEW
} from "../controllers/auth";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { 
  registerSchema, 
  loginSchema,
  emailVerificationSchema, // <-- NEW
  forgotPasswordSchema,    // <-- NEW
  resetPasswordSchema      // <-- NEW
} from "../schemas/authSchemas";

const router = Router();

// --- Public Routes ---
router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login); 

// --- ✅ NEW AUTH FLOWS ---
router.post("/verify-email", validate(emailVerificationSchema), verifyEmail);
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);
// --- END NEW AUTH FLOWS ---

// --- Token Management Routes ---
router.post("/refresh", refresh);
router.post("/logout", logout);

// --- Protected Test Route ---
router.get("/me", authenticate, (req, res) => {
  res.json({
    success: true,
    message: "Protected route accessed successfully!",
    user: (req as any).user,
  });
});

export default router;