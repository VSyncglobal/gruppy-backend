// src/controllers/paymentController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import { initiateSTKPush } from "../services/darajaService";
import { PaymentStatus } from "@prisma/client";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

export const createPayment = async (req: Request, res: Response) => {
  const { amount, phone, method, poolId } = req.body;
  const userId = (req as any).user.id;

  if (method.toUpperCase() !== "MPESA") {
    return res.status(400).json({ success: false, message: "Only MPESA payments are currently supported." });
  }
  
  // ✅ TODO: We need to verify the 'amount'
  // 1. Find the pool
  // 2. Get the 'quantity' from the request body (add to schema)
  // 3. const finalAmount = pool.pricePerUnit * quantity;
  // 4. if (finalAmount !== amount) { ... throw error }
  // For now, we trust the 'amount' from the client.

  try {
    // 1. Create a PENDING payment record in our database
    const payment = await prisma.payment.create({
      data: {
        amount,
        method: method.toUpperCase(),
        status: PaymentStatus.PENDING,
        // We will link the poolMember *after* payment is successful
      },
    });

    // 2. Initiate the STK push
    const stkResponse = await initiateSTKPush(
      amount,
      phone,
      payment.id // Pass our internal paymentId as the AccountReference
    );

    // 3. Send the STK push response back to the client
    res.status(200).json({
      success: true,
      message: "STK push initiated. Please complete the transaction on your phone.",
      paymentId: payment.id,
      checkoutRequestID: stkResponse.checkoutRequestID,
    });

  } catch (error: any) {
    logger.error("Error creating payment:", error);
    Sentry.captureException(error, { extra: { userId, poolId } });
    res.status(500).json({ success: false, message: error.message || "Payment initiation failed." });
  }
};

export const handlePaymentWebhook = async (req: Request, res: Response) => {
  logger.info("M-Pesa Webhook received...");
  const body = req.body;

  // TODO: Add a check for a 'secret' in the query params to verify
  // that this request is *actually* from Safaricom.

  const { Body: { stkCallback } } = body;

  if (!stkCallback) {
    logger.warn("Webhook received with no stkCallback");
    return res.status(400).json({ success: false, message: "Invalid callback" });
  }

  const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

  // Use AccountReference (which is our paymentId) to find the payment
  const paymentId = stkCallback.AccountReference; 
  
  if (!paymentId) {
     logger.error("Webhook received with no AccountReference (paymentId)", stkCallback);
     // Send 200 to acknowledge receipt so Daraja doesn't retry
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

    // Don't update an already-processed payment
    if (payment.status !== PaymentStatus.PENDING) {
      logger.warn(`Webhook for already processed payment: ${paymentId}, status: ${payment.status}`);
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    }
    
    // --- This is the SUCCESS case ---
    if (ResultCode === 0) {
      logger.info(`Webhook SUCCESS for payment ${paymentId}`);
      
      const metadata = CallbackMetadata.Item;
      const mpesaReceipt = metadata.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value;
      const transactionDate = metadata.find((i: any) => i.Name === "TransactionDate")?.Value; // YYYYMMDDHHMMSS

      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.SUCCESS,
          mpesa_receipt_number: mpesaReceipt,
          // ✅ Use our universal transaction ID
          providerTransactionId: CheckoutRequestID, 
          // Parse Daraja's YYYYMMDDHHMMSS format
          transaction_date: transactionDate 
            ? new Date(
                parseInt(transactionDate.slice(0, 4)),  // Year
                parseInt(transactionDate.slice(4, 6)) - 1, // Month (0-indexed)
                parseInt(transactionDate.slice(6, 8)),  // Day
                parseInt(transactionDate.slice(8, 10)), // Hour
                parseInt(transactionDate.slice(10, 12)),// Minute
                parseInt(transactionDate.slice(12, 14)) // Second
              )
            : new Date(),
          metadata: metadata, // Store the full callback metadata
        },
      });
      
      // TODO: Emit a socket.io event to the frontend
      // io.to(payment.userId).emit("paymentSuccess", { paymentId });

    } else {
      // --- This is the FAILED case ---
      // (e.g., user cancelled, auth failed, etc.)
      logger.warn(`Webhook FAILED for payment ${paymentId}: ${ResultDesc}`);
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.FAILED,
          metadata: stkCallback, // Store the error details
        },
      });
    }

    // Acknowledge receipt to Safaricom
    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

  } catch (error: any) {
    logger.error(`Error processing webhook for payment ${paymentId}:`, error);
    Sentry.captureException(error, { extra: { paymentId, CheckoutRequestID } });
    // Don't send 500, as Daraja will retry. Send 200.
    res.status(200).json({ ResultCode: 1, ResultDesc: "Internal server error" });
  }
};

// ... (getPaymentStatus function remains unchanged)
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

    res.status(200).json({ success: true, data: payment });
  } catch (error: any) {
    logger.error("Error fetching payment status:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};