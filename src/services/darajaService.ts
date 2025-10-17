import axios from "axios";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

const DARAJA_BASE_URL = process.env.DARAJA_BASE_URL || "https://sandbox.safaricom.co.ke";
const consumerKey = process.env.DARAJA_CONSUMER_KEY;
const consumerSecret = process.env.DARAJA_CONSUMER_SECRET;
const shortcode = process.env.DARAJA_BUSINESS_SHORTCODE;
const passkey = process.env.DARAJA_PASSKEY;

/**
 * Generate Safaricom OAuth token
 */
async function getDarajaToken(): Promise<string> {
  if (!consumerKey || !consumerSecret) {
    const msg = "Daraja consumer key or secret missing from environment.";
    logger.error(msg);
    Sentry.captureMessage(msg);
    throw new Error(msg);
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

  try {
    const response = await axios.get(
      `${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: { Authorization: `Basic ${auth}` },
      }
    );
    return response.data.access_token;
  } catch (error: any) {
    logger.error("Failed to get Daraja token", {
      error: error.response?.data || error.message,
    });
    Sentry.captureException(error);
    throw new Error("Failed to get Daraja token");
  }
}

/**
 * Initiate M-Pesa STK Push
 */
export async function initiateSTKPush(
  phoneNumber: string,
  amount: number,
  accountReference: string,
  transactionDesc: string
): Promise<any> {
  const token = await getDarajaToken();

  if (!shortcode || !passkey) {
    throw new Error("Daraja shortcode or passkey not configured.");
  }

  const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

  const callbackUrl = process.env.DARAJA_CALLBACK_URL || `https://nobby-rasheeda-earringed.ngrok-free.dev`;

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: process.env.DARAJA_TRANSACTION_TYPE || "CustomerPayBillOnline",
    Amount: amount,
    PartyA: phoneNumber,
    PartyB: shortcode,
    PhoneNumber: phoneNumber,
    CallBackURL: callbackUrl,
    AccountReference: accountReference,
    TransactionDesc: transactionDesc,
  };

  try {
    const { data } = await axios.post(
      `${DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    logger.info("✅ STK Push initiated successfully", { response: data });

    // 🧪 Sandbox mode simulation
    if (process.env.NODE_ENV !== "production") {
      logger.info("🧪 Sandbox mode: Simulating successful payment after 10 seconds...");

      setTimeout(async () => {
        try {
          const dummyTransactionId = `TX-${Date.now()}`;
          const dummyMetadata = {
            transaction_id: dummyTransactionId,
            message: "Simulated successful payment",
            timestamp: new Date().toISOString(),
          };

          await prisma.payment.update({
            where: { id: accountReference },
            data: {
              status: "SUCCESS",
              metadata: dummyMetadata,
              transaction_date: new Date(),
            },
          });

          logger.info(`💰 Sandbox simulation complete: Payment ${accountReference} marked SUCCESS`);
        } catch (simErr) {
          logger.error("⚠️ Sandbox simulation update failed", simErr);
        }
      }, 10000); // Wait 10 seconds
    }

    return data;
  } catch (error: any) {
    const errorData = error.response?.data || error.message;
    logger.error("❌ STK Push initiation failed", { error: errorData });
    Sentry.captureException(error);
    throw new Error(errorData.errorMessage || "Failed to initiate STK Push");
  }
}
