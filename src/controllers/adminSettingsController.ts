// src/controllers/adminSettingsController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

// Get all global settings
export const getAllSettings = async (req: Request, res: Response) => {
  try {
    const settings = await prisma.globalSetting.findMany({
      orderBy: { key: "asc" },
    });
    res.status(200).json({ success: true, data: settings });
  } catch (error: any) {
    logger.error("Error fetching global settings:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a new global setting
export const createSetting = async (req: Request, res: Response) => {
  try {
    const { key, value, notes } = req.body;
    const setting = await prisma.globalSetting.create({
      data: { key, value, notes },
    });
    res.status(201).json({ success: true, data: setting });
  } catch (error: any) {
    logger.error("Error creating global setting:", error);
    Sentry.captureException(error);
    if (error.code === "P2002" && error.meta?.target?.includes("key")) {
      return res
        .status(409)
        .json({ success: false, message: "A setting with this key already exists." });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update a global setting (by its key)
export const updateSetting = async (req: Request, res: Response) => {
  // --- THIS IS THE FIX: 'key' is now defined outside the try block ---
  const { key } = req.params;
  
  try {
    const { value, notes } = req.body;
    const setting = await prisma.globalSetting.update({
      where: { key },
      data: { value, notes },
    });
    res.status(200).json({ success: true, data: setting });
  } catch (error: any) {
    // --- The 'key' variable is now accessible here ---
    logger.error(`Error updating setting ${key}:`, error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, message: "Setting not found" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a global setting (by its key)
export const deleteSetting = async (req: Request, res: Response) => {
  // --- THIS IS THE FIX: 'key' is now defined outside the try block ---
  const { key } = req.params;

  try {
    await prisma.globalSetting.delete({
      where: { key },
    });
    res.status(204).send();
  } catch (error: any) {
    // --- The 'key' variable is now accessible here ---
    logger.error(`Error deleting setting ${key}:`, error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, message: "Setting not found" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};