// src/services/aiService.ts
import {
  GoogleGenerativeAI,
  GenerationConfig,
  SafetySetting,
  HarmCategory,
  HarmBlockThreshold, // ✅ NEW: Import the enum
} from "@google/generative-ai";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  throw new Error("GOOGLE_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// Configure model for JSON output
const generationConfig: GenerationConfig = {
  temperature: 0.2,
  topK: 1,
  topP: 1,
  maxOutputTokens: 2048,
  responseMimeType: "application/json",
};

// ✅ FIXED: Use the enum, not a string
const safetySettings: SafetySetting[] = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

// Define the shape of the JSON we expect
interface HSCodeSuggestion {
  hs_code: string;
  code_description: string;
  confidence: "High" | "Medium" | "Low";
  reasoning: string;
}

export const getHSCodeSuggestion = async (
  productDescription: string
): Promise<HSCodeSuggestion> => {
  try {
    const prompt = `
      You are an expert logistics and customs agent specializing in Kenyan and international trade.
      Your task is to identify the most accurate 6-digit Harmonized System (HS) code for a given product.

      Product Description: "${productDescription}"

      Please analyze the description and return a single JSON object with the following structure:
      {
        "hs_code": "XXXXXX",
        "code_description": "A brief description of the HS code category",
        "confidence": "High" | "Medium" | "Low",
        "reasoning": "A brief justification for your choice."
      }

      Provide only the raw JSON object as your response.
    `;

    const chat = model.startChat({
      generationConfig,
      safetySettings,
      history: [],
    });

    const result = await chat.sendMessage(prompt);
    const response = result.response;
    const jsonText = response.text();
    
    const suggestion = JSON.parse(jsonText) as HSCodeSuggestion;

    logger.info(`HS Code suggestion for "${productDescription}": ${suggestion.hs_code}`);
    return suggestion;

  } catch (error: any) {
    logger.error("Error getting HS code suggestion from AI:", error);
    Sentry.captureException(error);
    throw new Error("Failed to get HS code suggestion from AI.");
  }
};