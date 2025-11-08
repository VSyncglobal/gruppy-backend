// src/routes/paymentRoutes.ts
import { Router } from "express";
import {
  createPayment,
  handlePaymentWebhook,
  getPaymentStatus,
  getUserPaymentHistory, // --- THIS LINE FIXES THE ERROR ---
} from "../controllers/paymentController";
import { validate } from "../middleware/validate";
import { createPaymentSchema } from "../schemas/paymentSchemas";
import { authenticate } from "../middleware/auth";

const router = Router();

// Public webhook
router.post("/webhook", handlePaymentWebhook);

// Authenticated routes
router.use(authenticate);

router.post("/", validate(createPaymentSchema), createPayment);
router.get("/status/:paymentId", getPaymentStatus);

// --- NEW (v1.3): User's payment history ---
router.get("/history", getUserPaymentHistory);

export default router;