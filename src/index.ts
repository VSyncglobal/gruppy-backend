import express, { Request, Response } from "express";
import * as Sentry from "@sentry/node"; // ✨ ADD SENTRY IMPORT
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


// ✨ NEW: Import the job scheduler starter
import { startJobs } from "./jobs";

dotenv.config();
// ✨ INITIALIZE SENTRY - MUST BE THE FIRST THING
Sentry.init({
  dsn: process.env.SENTRY_DSN, // Add this to your .env file
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({ app }),
  ],
  tracesSampleRate: 1.0,
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());
app.use(express.json());
app.use(cors());
app.use(helmet());

// Rate limiting (100 requests/min)
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
});
app.use(limiter);

// Database (Postgres via Prisma)
const prisma = new PrismaClient();

// Redis client
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// Routes
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

app.use(Sentry.Handlers.errorHandler());

// Start server
app.listen(PORT, async () => {
  try {
    await prisma.$connect();
    logger.info("✅ Connected to PostgreSQL"); // ✨ REPLACE console.log

    await redis.ping();
    logger.info("✅ Connected to Redis"); // ✨ REPLACE console.log

    startJobs();
    logger.info("⏰ Cron jobs scheduled successfully."); // ✨ REPLACE console.log

  } catch (err) {
    logger.error("❌ Startup connection error:", err); // ✨ REPLACE console.error
    Sentry.captureException(err); // ✨ CAPTURE STARTUP ERRORS
  }

  logger.info(`🚀 Server running at http://localhost:${PORT}`); // ✨ REPLACE console.log
});