import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import { AuthRequest } from "../middleware/auth";
import { PaymentStatus } from "@prisma/client";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";
import { initiateSTKPush } from "../services/darajaService"; // IMPORT THE DARAJA SERVICE

/**
 * Initiates a payment for a user's spot in a pool by triggering an STK push.
 */
export const initiatePoolPayment = async (req: AuthRequest, res: Response) => {
  // Zod middleware has already validated poolMemberId and method
  const { poolMemberId, method, phone } = req.body;
  const userId = req.user?.id;

  if (method === "M-PESA" && !phone) {
    return res.status(400).json({ error: "Phone number is required for M-PESA payment" });
  }
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const poolMember = await prisma.poolMember.findFirst({
      where: { id: poolMemberId, userId: userId },
      include: { pool: true },
    });

    if (!poolMember) {
      return res
        .status(404)
        .json({ error: "Pool membership not found or you do not have access." });
    }

    if (poolMember.paymentId) {
      return res
        .status(400)
        .json({ error: "This pool membership has already been paid for." });
    }

    // Use 1 KES for sandbox testing, otherwise use the real amount.
    const amountToPay = process.env.NODE_ENV === "production"
        ? Math.round(poolMember.pool.pricePerUnit * poolMember.quantity)
        : 1;

    const newPayment = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          amount: amountToPay,
          status: PaymentStatus.PENDING,
          method: method,
        },
      });

      await tx.poolMember.update({
        where: { id: poolMemberId },
        data: { paymentId: payment.id },
      });

      return payment;
    });

    // If the payment method is M-PESA, trigger the STK Push
    if (method === "M-PESA") {
      await initiateSTKPush(
        phone,
        amountToPay,
        newPayment.id, // Use our internal payment ID as the AccountReference
        `Payment for Gruppy Pool: ${poolMember.pool.title}`
      );
    }

    res.status(201).json({
      success: true,
      message: `${method} payment initiated. Awaiting confirmation.`,
      data: { payment: newPayment },
    });
  } catch (error: any) {
    logger.error("Failed to initiate pool payment", { error: error.message, stack: error.stack });
    Sentry.captureException(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Handles incoming webhook confirmations from payment providers.
 */
export const handlePaymentWebhook = async (req: Request, res: Response) => {
  logger.info("WEBHOOK: Received a request on the payment webhook.");
  logger.debug("WEBHOOK Body:", req.body);  
  
  const { paymentId, status, transactionDetails } = req.body;

  if (!paymentId || !status) {
    return res.status(400).json({ error: "paymentId and status are required" });
  }

  try {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

    if (!payment) {
      return res.status(404).json({ error: "Payment record not found." });
    }

    if (payment.status !== PaymentStatus.PENDING) {
      return res.status(200).json({ message: "Payment already processed." });
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: status === "SUCCESS" ? PaymentStatus.SUCCESS : PaymentStatus.FAILED,
        metadata: transactionDetails,
        transaction_date: new Date(),
      },
    });

    logger.info(`WEBHOOK: Payment ${paymentId} status updated to ${updatedPayment.status}`);

    // Always respond with a 200 OK to the webhook provider
    res.status(200).json({ success: true, message: "Webhook received." });
  } catch (error) {
    logger.error("Webhook processing failed:", error);
    Sentry.captureException(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};