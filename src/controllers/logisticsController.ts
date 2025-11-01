// src/controllers/logisticsController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";

// Create a new logistics route
export const createLogisticsRoute = async (req: Request, res: Response) => {
  try {
    const route = await prisma.logisticsRoute.create({
      data: { ...req.body },
    });
    res.status(201).json({ success: true, data: route });
  } catch (error: any) {
    logger.error("Error creating logistics route:", error);
    Sentry.captureException(error);
    if (error.code === "P2002" && error.meta?.target?.includes("name")) {
      return res
        .status(409)
        .json({ success: false, message: "A route with this name already exists." });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all logistics routes
export const getAllLogisticsRoutes = async (req: Request, res: Response) => {
  try {
    const routes = await prisma.logisticsRoute.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ success: true, data: routes });
  } catch (error: any) {
    logger.error("Error fetching logistics routes:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get a single logistics route by ID
export const getLogisticsRouteById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const route = await prisma.logisticsRoute.findUnique({
      where: { id },
    });
    if (!route) {
      return res.status(404).json({ success: false, message: "Route not found" });
    }
    res.status(200).json({ success: true, data: route });
  } catch (error: any) {
    logger.error("Error fetching logistics route:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update a logistics route
export const updateLogisticsRoute = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const route = await prisma.logisticsRoute.update({
      where: { id },
      data: { ...req.body },
    });
    res.status(200).json({ success: true, data: route });
  } catch (error: any) {
    logger.error("Error updating logistics route:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, message: "Route not found" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a logistics route
export const deleteLogisticsRoute = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.logisticsRoute.delete({
      where: { id },
    });
    res.status(204).send(); // No Content
  } catch (error: any) {
    logger.error("Error deleting logistics route:", error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, message: "Route not found" });
    }
     if (error.code === "P2003") {
      return res.status(409).json({
        success: false,
        message: "Cannot delete route, it is still linked to active pools.",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};