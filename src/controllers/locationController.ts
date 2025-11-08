// src/controllers/locationController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

/**
 * Fetches all Kenyan towns, ordered by county and name.
 */
export const getKenyanTowns = async (req: Request, res: Response) => {
  try {
    const towns = await prisma.kenyanTown.findMany({
      orderBy: [{ county: "asc" }, { name: "asc" }],
    });

    if (towns.length === 0) {
      logger.warn("getKenyanTowns: No Kenyan towns found in the database. Please run the seed script.");
      return res.status(200).json({ 
        success: true, 
        data: [], 
        message: "No towns found. Please contact support." 
      });
    }

    res.status(200).json({ success: true, data: towns });
  } catch (error: any) {
    logger.error("Error fetching Kenyan towns:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};