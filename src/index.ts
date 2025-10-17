// ✨ FIX: Import the instrument file at the very top
import "./instrument"; 

import express, { Request, Response, NextFunction } from "express";
import * as Sentry from "@sentry/node";
import logger from "./utils/logger";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

// Route Imports
import authRouter from "./routes/auth";
import pricingRoutes from "./routes/pricing";
import pricingLogRoutes from "./routes/pricingLog";
import adminFreightRoutes from "./routes/adminFreight";
import adminTaxRoutes from "./routes/adminTax";
import userRoutes from "./routes/userRoutes";
import poolRoutes from "./routes/poolRoutes";
import healthRouter from "./routes/health";
import paymentRoutes from "./routes/paymentRoutes";
import productRoutes from "./routes/productRoutes";
import adminUserRoutes from "./routes/adminUserRoutes";
import adminAffiliateRoutes from "./routes/adminAffiliateRoutes";

// Job Scheduler
import { startJobs } from "./jobs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Core Middleware
app.set('trust proxy', 'loopback, linklocal, uniquelocal');

app.use(express.json());
app.use(cors());
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
});
app.use(limiter);

// Database and Redis clients
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// API Routes
app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/api/pricing", pricingRoutes);
app.use("/api/pricing/logs", pricingLogRoutes);
app.use("/api/admin/freight", adminFreightRoutes);
app.use("/api/admin/tax", adminTaxRoutes);
app.use("/api/user", userRoutes);
app.use("/api/pools", poolRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/products", productRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/affiliates", adminAffiliateRoutes);

// Root route
app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Gruppy Backend API is running 🚀" });
});

// ✨ NEW: Sentry verification route from documentation
app.get("/debug-sentry", function mainHandler(req, res) {
  throw new Error("My first Sentry error!");
});

// ✨ FIX: The Sentry error handler must be registered before any other error middleware and after all controllers
Sentry.setupExpressErrorHandler(app);

// Optional fallthrough error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // The error id is attached to `res.sentry` to be returned
  // and optionally displayed to the user for support.
  res.statusCode = 500;
  res.end((res as any).sentry + "\n");
});

// Start server
app.listen(PORT, async () => {
  try {
    await prisma.$connect();
    logger.info("✅ Connected to PostgreSQL");
    await redis.ping();
    logger.info("✅ Connected to Redis");
    startJobs();
  } catch (err) {
    logger.error("❌ Startup connection error:", { error: err });
    Sentry.captureException(err);
  }
  logger.info(`🚀 Server running at http://localhost:${PORT}`);
});