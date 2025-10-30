// src/services/darajaService.ts
import axios from "axios";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";
import { PaymentStatus } from "@prisma/client";

// ... (getDarajaToken function remains unchanged)
const getDarajaToken = async (): Promise<string> => {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error("M-Pesa credentials are not set.");
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

  try {
    const response = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );
    return response.data.access_token;
  } catch (error: any) {
    logger.error("Error getting Daraja token:", error.response?.data || error.message);
    Sentry.captureException(error);
    throw new Error("Could not authenticate with Daraja API.");
  }
};


// ✅ --- MODIFIED initiateSTKPush --- ✅
export const initiateSTKPush = async (
  amount: number,
  phone: string,
  paymentId: string // We now use our internal paymentId as the reference
) => {
  const token = await getDarajaToken();
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const callbackURL = process.env.MPESA_CALLBACK_URL;

  if (!shortcode || !passkey || !callbackURL) {
    throw new Error("M-Pesa STK push config is not set.");
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, -3); // YYYYMMDDHHMMSS
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

  // Use 1 KES if in development, otherwise the full amount
  const transactionAmount = process.env.NODE_ENV !== "production" ? 1 : amount;
  
  // Format phone number to 254...
  const formattedPhone = phone.startsWith("0")
    ? `254${phone.substring(1)}`
    : phone;

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline", // or "CustomerBuyGoodsOnline"
    Amount: transactionAmount,
    PartyA: formattedPhone,
    PartyB: shortcode,
    PhoneNumber: formattedPhone,
    CallBackURL: callbackURL,
    AccountReference: paymentId, // Use our internal paymentId
    TransactionDesc: `Payment for Gruppy order ${paymentId}`,
  };

  try {
    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { MerchantRequestID, CheckoutRequestID, ResponseDescription, ResponseCode, CustomerMessage } = response.data;

    if (ResponseCode === "0") {
      logger.info(`STK push initiated for payment ${paymentId}. CheckoutRequestID: ${CheckoutRequestID}`);
      // ✅ SUCCESS: The STK push was sent.
      // We DO NOT update the payment here. We wait for the webhook.
      return {
        success: true,
        merchantRequestID: MerchantRequestID,
        checkoutRequestID: CheckoutRequestID,
        message: CustomerMessage,
      };
    } else {
      // The request to Daraja failed
      logger.error(`STK push initiation failed for payment ${paymentId}: ${ResponseDescription}`);
      Sentry.captureException(new Error(ResponseDescription), { extra: { paymentId, ResponseCode } });
      throw new Error(ResponseDescription || "STK push initiation failed.");
    }

  } catch (error: any) {
    logger.error(`Error in STK push for payment ${paymentId}:`, error.response?.data || error.message);
    Sentry.captureException(error, { extra: { paymentId } });
    throw new Error(error.response?.data?.errorMessage || "An error occurred during STK push.");
  }
  
  // ✅ REMOVED: The entire setTimeout block that simulated the webhook
  // is now gone.
};