// src/controllers/locationController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

/**
 * (Unchanged)
 * Fetches all Kenyan towns, ordered by county and name.
 */
export const getKenyanTowns = async (req: Request, res: Response) => {
  try {
    const towns = await prisma.kenyanTown.findMany({
      orderBy: [{ county: "asc" }, { name: "asc" }],
    });

    if (towns.length === 0) {
      logger.warn(
        "getKenyanTowns: No Kenyan towns found in the database. Please run the seed script."
      );
      return res.status(200).json({
        success: true,
        data: [],
        message: "No towns found. Please contact support.",
      });
    }

    res.status(200).json({ success: true, data: towns });
  } catch (error: any) {
    logger.error("Error fetching Kenyan towns:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * --- NEW (v_phase5) ---
 * Admin: Create a new Kenyan town
 */
export const createTown = async (req: Request, res: Response) => {
  try {
    const { name, county } = req.body;
    const town = await prisma.kenyanTown.create({
      data: { name, county },
    });
    res.status(201).json({ success: true, data: town });
  } catch (error: any) {
    logger.error("Error creating town:", error);
    Sentry.captureException(error);
    if (error.code === "P2002" && error.meta?.target?.includes("name_county")) {
      return res.status(409).json({
        success: false,
        message: "This combination of town and county already exists.",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * --- NEW (v_phase5) ---
 * Admin: Update an existing Kenyan town
 */
export const updateTown = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, county } = req.body;
    const town = await prisma.kenyanTown.update({
      where: { id },
      data: { name, county },
    });
    res.status(200).json({ success: true, data: town });
  } catch (error: any) {
    logger.error(`Error updating town ${req.params.id}:`, error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Town not found." });
    }
    if (error.code === "P2002" && error.meta?.target?.includes("name_county")) {
      return res.status(409).json({
        success: false,
        message: "This combination of town and county already exists.",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * --- NEW (v_phase5) ---
 * Admin: Delete a Kenyan town
 */
export const deleteTown = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.kenyanTown.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error: any) {
    logger.error(`Error deleting town ${req.params.id}:`, error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Town not found." });
    }
    // Check if a UserAddress is still linked to this town
    if (error.code === "P2003") {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete town, it is still linked to one or more user addresses.",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};