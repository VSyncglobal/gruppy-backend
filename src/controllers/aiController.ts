// src/controllers/aiController.ts
import { Request, Response } from "express";
import { getHSCodeSuggestion } from "../services/aiService";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

export const suggestHSCodeHandler = async (req: Request, res: Response) => {
  try {
    const { description } = req.body;
    
    // --- NEW: Get the userId if the user is logged in ---
    const userId = (req as any).user?.id;

    // --- MODIFIED: Pass the userId to the service ---
    const suggestion = await getHSCodeSuggestion(description, userId);

    res.status(200).json({ success: true, data: suggestion });
  } catch (error: any) {
    logger.error("Error in suggestHSCodeHandler:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};