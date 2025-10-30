// src/controllers/aiController.ts
import { Request, Response } from "express";
import { getHSCodeSuggestion } from "../services/aiService";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

export const suggestHSCodeHandler = async (req: Request, res: Response) => {
  try {
    const { description } = req.body;

    const suggestion = await getHSCodeSuggestion(description);

    res.status(200).json({ success: true, data: suggestion });
  } catch (error: any) {
    logger.error("Error in suggestHSCodeHandler:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};