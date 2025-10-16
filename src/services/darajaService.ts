import axios from "axios";
import logger from "../utils/logger";

const DARAJA_BASE_URL = "https://sandbox.safaricom.co.ke"; // Use sandbox for testing

const consumerKey = process.env.DARAJA_CONSUMER_KEY;
const consumerSecret = process.env.DARAJA_CONSUMER_SECRET;
const shortcode = process.env.DARAJA_BUSINESS_SHORTCODE;
const passkey = process.env.DARAJA_PASSKEY;

// Function to get an OAuth token from Daraja
async function getDarajaToken(): Promise<string | null> {
  if (!consumerKey || !consumerSecret) {
    logger.error("Daraja consumer key or secret is not configured.");
    return null;
  }
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

  try {
    const response = await axios.get(
      `${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    return response.data.access_token;
  } catch (error: any) {
    logger.error("Failed to get Daraja token", { error: error.response?.data || error.message });
    return null;
  }
}

// Function to initiate an STK push
export async function initiateSTKPush(
  phoneNumber: string, // e.g., 2547XXXXXXXX
  amount: number,
  accountReference: string, // A unique identifier for the transaction
  transactionDesc: string
): Promise<any> {
  const token = await getDarajaToken();
  if (!token) {
    throw new Error("Could not authenticate with Daraja API.");
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
  const callbackUrl = `https://nobby-rasheeda-earringed.ngrok-free.dev`; // Replace with your actual ngrok URL

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: process.env.DARAJA_TRANSACTION_TYPE,
    Amount: amount,
    PartyA: phoneNumber,
    PartyB: shortcode,
    PhoneNumber: phoneNumber,
    CallBackURL: callbackUrl,
    AccountReference: accountReference,
    TransactionDesc: transactionDesc,
  };

  try {
    const response = await axios.post(
      `${DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    logger.info("STK Push initiated successfully", { response: response.data });
    return response.data;
  } catch (error: any) {
    logger.error("STK Push initiation failed", { error: error.response?.data || error.message });
    throw new Error("Failed to initiate STK Push.");
  }
}