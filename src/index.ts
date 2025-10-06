import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import authRouter from "./routes/auth";


import healthRouter from "./routes/health";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
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


// Root route
app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Gruppy Backend API is running 🚀" });
});

// Start server
app.listen(PORT, async () => {
  try {
    await prisma.$connect();
    console.log("✅ Connected to PostgreSQL");

    await redis.ping();
    console.log("✅ Connected to Redis");
  } catch (err) {
    console.error("❌ Startup connection error:", err);
  }

  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
