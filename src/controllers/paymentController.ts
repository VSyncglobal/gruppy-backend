// src/controllers/paymentController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import { initiateSTKPush } from "../services/darajaService";
import { PaymentStatus, PaymentMethod } from "@prisma/client";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";
import crypto from "crypto"; // --- (Fix 4): Import crypto
import { triggerPoolSettlement } from "../hooks/poolFinanceHooks";

/**
 * Initiates a payment for an *existing* PENDING payment record.
 * (Unchanged)
 */
export const createPayment = async (req: Request, res: Response) => {
  const { phone, method, paymentId } = req.body;
  const userId = (req as any).user.id;

  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        poolMember: {
          select: { userId: true },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment record not found." });
    }
    if (payment.poolMember?.userId !== userId) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this payment." });
    }
    if (payment.status !== PaymentStatus.PENDING) {
      return res.status(400).json({ success: false, message: `Payment is not pending. Current status: ${payment.status}` });
    }
    if (payment.method !== method) {
      return res.status(400).json({ 
        success: false, 
        message: `Payment method mismatch. This payment was created for ${payment.method}, not ${method}.` 
      });
    }

    switch (method) {
      case PaymentMethod.MPESA:
        const stkResponse = await initiateSTKPush(
          payment.amount,
          phone,
          payment.id 
        );
        
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            providerTransactionId: stkResponse.checkoutRequestID,
          },
        });
        
        return res.status(200).json({
          success: true,
          message: "STK push initiated. Please complete the transaction on your phone.",
          paymentId: payment.id,
          checkoutRequestID: stkResponse.checkoutRequestID,
        });

      case PaymentMethod.STRIPE:
      case PaymentMethod.AIRTEL_MONEY:
      case PaymentMethod.ACCOUNT_BALANCE:
        return res.status(501).json({ success: false, message: "This payment method is not yet implemented." });

      default:
        return res.status(400).json({ success: false, message: "Invalid payment method." });
    }

  } catch (error: any) {
    logger.error("Error initiating payment:", error);
    Sentry.captureException(error, { extra: { userId, paymentId, method } });
    res.status(500).json({ success: false, message: error.message || "Payment initiation failed." });
  }
};

/**
 * --- MODIFIED (Fix 4 & 5) ---
 */
export const handlePaymentWebhook = async (req: Request, res: Response) => {
  logger.info("M-Pesa Webhook received...");

  // --- (Fix 4): Verify webhook authenticity ---
  const webhookSecret = process.env.MPESA_WEBHOOK_SECRET;
  const signature = req.headers['x-mpesa-signature'] as string;
  
  // Only check signature in production
  if (process.env.NODE_ENV === 'production') {
    if (webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('base64'); // M-Pesa uses base64
      
      if (signature !== expectedSignature) {
        logger.error("Invalid webhook signature");
        return res.status(401).json({ ResultCode: 1, ResultDesc: "Unauthorized: Invalid signature" });
      }
    } else {
      logger.error("Webhook security not configured. MPESA_WEBHOOK_SECRET is missing.");
      return res.status(500).json({ ResultCode: 1, ResultDesc: "Internal Error: Webhook security not configured." });
    }
  }
  // --- END (Fix 4) ---

  const body = req.body;

  if (!body.Body || !body.Body.stkCallback) {
    logger.warn("Webhook received with no stkCallback");
    return res.status(400).json({ success: false, message: "Invalid callback" });
  }

  const { Body: { stkCallback } } = body;
  const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

  if (!CheckoutRequestID) {
     logger.error("Webhook received with no CheckoutRequestID", stkCallback);
     return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted (No CheckoutRequestID)" });
  }

  try {
    const payment = await prisma.payment.findUnique({
      where: { providerTransactionId: CheckoutRequestID },
    });
    
    const paymentId = payment?.id;

    if (!payment) {
      logger.error(`Webhook for unknown CheckoutRequestID: ${CheckoutRequestID}`);
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted (Payment not found)" });
    }

    if (payment.status !== PaymentStatus.PENDING) {
      logger.warn(`Webhook for already processed payment: ${paymentId}, status: ${payment.status}`);
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted (Already Processed)" });
    }
    
    // --- SUCCESS case ---
    if (ResultCode === 0) {
      logger.info(`Webhook SUCCESS for payment ${paymentId}`);
      
      const metadata = CallbackMetadata.Item;
      const mpesaReceipt = metadata.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value;
      
      // --- (Fix 5): Safe Date Parsing ---
      const transactionDateValue = metadata.find((i: any) => i.Name === "TransactionDate")?.Value;
      let transactionDate = new Date(); // Default to now

      if (transactionDateValue) {
        try {
          const dateStr = String(transactionDateValue);
          if (dateStr.length === 14) {
            transactionDate = new Date(
              parseInt(dateStr.slice(0, 4)),    // Year
              parseInt(dateStr.slice(4, 6)) - 1, // Month
              parseInt(dateStr.slice(6, 8)),    // Day
              parseInt(dateStr.slice(8, 10)),   // Hour
              parseInt(dateStr.slice(10, 12)),  // Minute
              parseInt(dateStr.slice(12, 14))   // Second
            );
          } else {
            logger.warn(`Invalid transaction date format: ${dateStr}. Defaulting to now.`);
          }
        } catch (error) {
          logger.error("Error parsing transaction date. Defaulting to now.", error);
        }
      }
      // --- END (Fix 5) ---

      // Use a transaction to update payment AND trigger settlement
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: paymentId as string },
          data: {
            status: PaymentStatus.SUCCESS,
            providerConfirmationCode: String(mpesaReceipt),
            providerTransactionId: CheckoutRequestID,
            transaction_date: transactionDate,
            metadata: metadata,
          },
        });
        
        // Trigger the pool settlement hook
        await triggerPoolSettlement(tx, payment.poolMemberId);
      });
      
    } else {
      // --- FAILED case ---
      logger.warn(`Webhook FAILED for payment ${paymentId}: ${ResultDesc}`);
      await prisma.payment.update({
        where: { id: paymentId as string },
        data: {
          status: PaymentStatus.FAILED,
          metadata: stkCallback,
        },
      });
    }

    // Acknowledge receipt to Safaricom
    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

  } catch (error: any) {
    logger.error(`Error processing webhook for CheckoutRequestID ${CheckoutRequestID}:`, error);
    Sentry.captureException(error, { extra: { CheckoutRequestID } });
    res.status(200).json({ ResultCode: 1, ResultDesc: "Accepted (Internal Error)" });
  }
};

/**
 * --- MODIFIED (Fix 6): Added security check ---
 * (This includes the fix from your analysis for Issue 6)
 */
export const getPaymentStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id; // Get user ID
    const { paymentId } = req.params;
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        status: true,
        id: true,
        poolMember: {
          select: {
            poolId: true,
            userId: true // --- NEW: Get userId for check
          },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }
    
    // --- NEW (Fix 6): Security check ---
    if (payment.poolMember?.userId !== userId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    // --- END (Fix 6) ---

    res.status(200).json({ success: true, data: { status: payment.status, id: payment.id, poolId: payment.poolMember?.poolId } });
  } catch (error: any) {
    logger.error("Error fetching payment status:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- NEW (v1.3): Get all payments for the logged-in user ---
// (Unchanged)
export const getUserPaymentHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const payments = await prisma.payment.findMany({
      where: {
        poolMember: {
          userId: userId,
        },
      },
      include: {
        poolMember: {
          select: {
            pool: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({ success: true, data: payments });
  } catch (error: any) {
    logger.error("Error fetching user payment history:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};