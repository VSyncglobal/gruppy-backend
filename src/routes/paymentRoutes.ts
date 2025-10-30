// src/routes/paymentRoutes.ts
import { Router } from "express";
import {
  createPayment, // ✅ FIXED: Changed from 'initiatePoolPayment'
  handlePaymentWebhook,
  getPaymentStatus,
} from "../controllers/paymentController";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { initiatePaymentSchema } from "../schemas/paymentSchemas";

const router = Router();

router.post(
  "/initiate",
  authenticate,
  validate(initiatePaymentSchema),
  createPayment // ✅ FIXED: Use the new function name
);
router.post("/webhook", handlePaymentWebhook);
router.get("/status/:paymentId", authenticate, getPaymentStatus);

export default router;