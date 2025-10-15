import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  initiatePoolPayment,
  handlePaymentWebhook,
} from "../controllers/paymentController";

const router = Router();

// This endpoint is for authenticated users to start a payment process.
router.post("/pools/initiate", authenticate, initiatePoolPayment);

// This endpoint is public for external services (like M-Pesa) to send confirmations.
// It should NOT have the 'authenticate' middleware.
router.post("/webhook/confirmation", handlePaymentWebhook);

export default router;