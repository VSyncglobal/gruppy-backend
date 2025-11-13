// src/controllers/adminBulkOrderController.ts
import { Request, Response } from "express";
import prisma from "../utils/prismaClient";
import logger from "../utils/logger";
import * as Sentry from "@sentry/node";
import { Prisma } from "@prisma/client";

/**
 * Admin: Get all Bulk Orders
 */
export const getAllBulkOrders = async (req: Request, res: Response) => {
  try {
    const bulkOrders = await prisma.bulkOrder.findMany({
      include: {
        // Include the related pool's title and status for context
        pool: {
          select: {
            id: true,
            title: true,
            status: true,
            currentQuantity: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ success: true, data: bulkOrders });
  } catch (error: any) {
    logger.error("Error fetching all bulk orders:", error);
    Sentry.captureException(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Get a single Bulk Order by ID
 */
export const getBulkOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const bulkOrder = await prisma.bulkOrder.findUniqueOrThrow({
      where: { id },
      include: {
        // Include all related pool data for a detailed view
        pool: {
          include: {
            product: true,
            finance: true,
          },
        },
      },
    });
    res.status(200).json({ success: true, data: bulkOrder });
  } catch (error: any) {
    logger.error(`Error fetching bulk order ${req.params.id}:`, error);
    Sentry.captureException(error);
    if (error.code === "P2025" || error.name === "NotFoundError") {
      return res
        .status(404)
        .json({ success: false, message: "Bulk Order not found." });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Update a Bulk Order's status or financial details
 */
export const updateBulkOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      status,
      totalOrderCostKES,
      totalLogisticsCostKES,
      totalTaxesKES,
      costPerItemUSD,
      exchangeRate,
    } = req.body;

    // Build the data object with only the fields that were provided
    const dataToUpdate: Prisma.BulkOrderUpdateInput = {};
    if (status) dataToUpdate.status = status;
    if (totalOrderCostKES) dataToUpdate.totalOrderCostKES = totalOrderCostKES;
    if (totalLogisticsCostKES)
      dataToUpdate.totalLogisticsCostKES = totalLogisticsCostKES;
    if (totalTaxesKES) dataToUpdate.totalTaxesKES = totalTaxesKES;
    if (costPerItemUSD) dataToUpdate.costPerItemUSD = costPerItemUSD;
    if (exchangeRate) dataToUpdate.exchangeRate = exchangeRate;

    const updatedBulkOrder = await prisma.bulkOrder.update({
      where: { id },
      data: dataToUpdate,
    });

    res.status(200).json({ success: true, data: updatedBulkOrder });
  } catch (error: any) {
    logger.error(`Error updating bulk order ${req.params.id}:`, error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Bulk Order not found." });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Delete a Bulk Order
 */
export const deleteBulkOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // The relation on Pool is optional (BulkOrder?), so deleting this
    // will just set the link on the Pool to null. This is safe.
    await prisma.bulkOrder.delete({
      where: { id },
    });

    res.status(204).send(); // 204 No Content
  } catch (error: any) {
    logger.error(`Error deleting bulk order ${req.params.id}:`, error);
    Sentry.captureException(error);
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Bulk Order not found." });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};