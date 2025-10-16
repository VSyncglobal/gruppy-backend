import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import { AuthRequest } from "../middleware/auth";
import { PaymentStatus } from "@prisma/client";

/**
 * Initiates a payment for a user's spot in a pool.
 * Triggered by the user.
 */
export const initiatePoolPayment = async (req: AuthRequest, res: Response) => {
  const { poolMemberId, method } = req.body;
  const userId = req.user?.id;

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

    const amountToPay = poolMember.pool.pricePerUnit * poolMember.quantity;

    const transactionResult = await prisma.$transaction(async (tx) => {
      const newPayment = await tx.payment.create({
        data: {
          amount: amountToPay,
          status: PaymentStatus.PENDING,
          method: method,
        },
      });

      await tx.poolMember.update({
        where: { id: poolMemberId },
        data: { paymentId: newPayment.id },
      });

      return newPayment;
    });

    console.log(
      `SIMULATION: Initiating ${method} payment for PoolMember ${poolMemberId} amounting to KES ${amountToPay}`
    );

    res.status(201).json({
      success: true,
      message: `Payment initiated via ${method}. Awaiting confirmation.`,
      data: {
        payment: transactionResult,
      },
    });
  } catch (error) {
    console.error("Failed to initiate pool payment:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Handles incoming webhook confirmations from payment providers.
 * Triggered by the external payment service (e.g., M-Pesa, Stripe).
 */
export const handlePaymentWebhook = async (req: Request, res: Response) => {
  // In a real application, you would first verify the request's signature
  // to ensure it genuinely came from the payment provider.
  const { paymentId, status, transactionDetails } = req.body;

  if (!paymentId || !status) {
    return res.status(400).json({ error: "paymentId and status are required" });
  }

  try {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

    if (!payment) {
      return res.status(404).json({ error: "Payment record not found." });
    }

    // Idempotency check: Prevents re-processing a completed payment.
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

    console.log(
      `WEBHOOK: Payment ${paymentId} status updated to ${updatedPayment.status}`
    );

    // FUTURE: If successful, you could add logic here to trigger another
    // event, like updating the PoolFinance totals again.

    // Always respond with a 200 OK to the webhook provider
    res.status(200).json({ success: true, message: "Webhook received." });
  } catch (error) {
    console.error("Webhook processing failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};