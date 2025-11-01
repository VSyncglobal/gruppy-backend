// src/controllers/paymentController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import { initiateSTKPush } from "../services/darajaService";
import { PaymentStatus, PaymentMethod } from "@prisma/client";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

// --- THIS FUNCTION IS NOW REWRITTEN ---
/**
 * Initiates a payment for an *existing* PENDING payment record.
 * This is called *after* a user has already joined a pool.
 */
export const createPayment = async (req: Request, res: Response) => {
  const { phone, method, paymentId } = req.body;
  const userId = (req as any).user.id;

  try {
    // 1. Find the pending payment by its ID
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        poolMember: {
          select: { userId: true },
        },
      },
    });

    // 2. Run security and status checks
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

    // 3. --- Payment Provider Logic ---
    // We can now use a switch to handle different payment providers
    switch (method) {
      case PaymentMethod.MPESA:
        // Initiate the STK push
        const stkResponse = await initiateSTKPush(
          payment.amount,
          phone,
          payment.id // Pass our internal paymentId as the AccountReference
        );
        
        return res.status(200).json({
          success: true,
          message: "STK push initiated. Please complete the transaction on your phone.",
          paymentId: payment.id,
          checkoutRequestID: stkResponse.checkoutRequestID,
        });

      case PaymentMethod.STRIPE:
      case PaymentMethod.AIRTEL_MONEY:
        // TODO: Add logic for other payment providers
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

export const handlePaymentWebhook = async (req: Request, res: Response) => {
  logger.info("M-Pesa Webhook received...");
  const body = req.body;

  // TODO: Verify webhook secret

  const { Body: { stkCallback } } = body;

  if (!stkCallback) {
    logger.warn("Webhook received with no stkCallback");
    return res.status(400).json({ success: false, message: "Invalid callback" });
  }

  const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

  const paymentId = stkCallback.AccountReference; 
  
  if (!paymentId) {
     logger.error("Webhook received with no AccountReference (paymentId)", stkCallback);
     return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      logger.error(`Webhook for unknown paymentId: ${paymentId}`);
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    if (payment.status !== PaymentStatus.PENDING) {
      logger.warn(`Webhook for already processed payment: ${paymentId}, status: ${payment.status}`);
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    }
    
    // --- This is the SUCCESS case ---
    if (ResultCode === 0) {
      logger.info(`Webhook SUCCESS for payment ${paymentId}`);
      
      const metadata = CallbackMetadata.Item;
      const mpesaReceipt = metadata.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value;
      const transactionDateStr = metadata.find((i: any) => i.Name === "TransactionDate")?.Value; // YYYYMMDDHHMMSS
      
      const transactionDate = transactionDateStr 
            ? new Date(
                parseInt(transactionDateStr.slice(0, 4)),  // Year
                parseInt(transactionDateStr.slice(4, 6)) - 1, // Month (0-indexed)
                parseInt(transactionDateStr.slice(6, 8)),  // Day
                parseInt(transactionDateStr.slice(8, 10)), // Hour
                parseInt(transactionDateStr.slice(10, 12)),// Minute
                parseInt(transactionDateStr.slice(12, 14)) // Second
              )
            : new Date();

      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.SUCCESS,
          providerConfirmationCode: mpesaReceipt,
          providerTransactionId: CheckoutRequestID, 
          transaction_date: transactionDate,
          metadata: metadata,
        },
      });
      
    } else {
      // --- This is the FAILED case ---
      logger.warn(`Webhook FAILED for payment ${paymentId}: ${ResultDesc}`);
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.FAILED,
          metadata: stkCallback,
        },
      });
      
      // NOTE: We DO NOT trigger the finance hook here.
      // The cleanup job will handle the deletion and finance update.
    }

    // Acknowledge receipt to Safaricom
    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

  } catch (error: any) {
    logger.error(`Error processing webhook for payment ${paymentId}:`, error);
    Sentry.captureException(error, { extra: { paymentId, CheckoutRequestID } });
    res.status(200).json({ ResultCode: 1, ResultDesc: "Internal server error" });
  }
};

export const getPaymentStatus = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        status: true,
        id: true,
        poolMember: {
          select: {
            poolId: true,
          },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }
    
    // TODO: Add security check to ensure user owns this payment

    res.status(200).json({ success: true, data: payment });
  } catch (error: any) {
    logger.error("Error fetching payment status:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};