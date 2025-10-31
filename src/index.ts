// src/index.ts (FINAL CORRECTED VERSION)

import './instrument'; // Sentry instrument file
import express, { Express, Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import logger from './utils/logger';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import cookieParser from 'cookie-parser'; // ✅ FIX 1: Imports the package you just installed

// Route Imports
import authRouter from './routes/auth';
import pricingRoutes from './routes/pricing';
import categoryRoutes from './routes/categoryRoutes';
import pricingLogRoutes from './routes/pricingLog';
import adminFreightRoutes from './routes/adminFreight';
import adminTaxRoutes from './routes/adminTax';
import userRoutes from './routes/userRoutes';
import adminPaymentRoutes from './routes/adminPaymentRoutes';
import poolRoutes from './routes/poolRoutes';
import healthRouter from './routes/health';
import paymentRoutes from './routes/paymentRoutes';
import productRoutes from './routes/productRoutes';
import adminUserRoutes from './routes/adminUserRoutes';
import adminAffiliateRoutes from './routes/adminAffiliateRoutes';
import reviewRoutes from './routes/reviewRoutes';
import aiRoutes from './routes/aiRoutes';

// Job Scheduler
import { startJobs } from './jobs';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Core Middleware
app.set('trust proxy', 'loopback, linklocal, uniquelocal');
app.use(express.json());

// --- ✅ FIX 2: Correct CORS Configuration ---
const allowedOrigins = [
  'http://localhost:3000', // For your local frontend
  'https://gruppy-backend.onrender.com', // <-- REPLACE WITH YOUR VERCEL URL
  // Add any other frontend URLs you have
];
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy does not allow access from origin ${origin}`));
    }
  },
  credentials: true, // This is required for cookies
};
app.use(cors(corsOptions));
// --- End of CORS Fix ---

app.use(helmet());
app.use(cookieParser()); // ✅ FIX: This MUST be included

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
});
app.use(limiter);

// Database and Redis clients
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// API Routes
app.use('/health', healthRouter);
app.use('/api/auth', authRouter); // ✅ FIX 3: This adds the /api prefix
app.use('/api/pricing', pricingRoutes);
app.use('/api/pricing/logs', pricingLogRoutes);
app.use('/api/admin/freight', adminFreightRoutes);
app.use('/api/admin/tax', adminTaxRoutes);
app.use('/api/admin/payments', adminPaymentRoutes);
app.use('/api/user', userRoutes);
app.use('/api/pools', poolRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/affiliates', adminAffiliateRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/ai', aiRoutes);

// Root route
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Gruppy Backend API is running 🚀' });
});

// Sentry verification route
app.get('/debug-sentry', function mainHandler(req: Request, res: Response) {
  throw new Error('My first Sentry error!');
});

// Sentry error handler
Sentry.setupExpressErrorHandler(app);

// Optional fallthrough error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res.statusCode = 500;
  res.end((res as any).sentry + '\n');
});

// Start server
app.listen(PORT, async () => {
  try {
    await prisma.$connect();
    logger.info('✅ Connected to PostgreSQL');
    await redis.ping();
    logger.info('✅ Connected to Redis');
    startJobs();
  } catch (err) {
    logger.error('❌ Startup connection error:', { error: err });
    Sentry.captureException(err);
  }
  logger.info(`🚀 Server running at http://localhost:${PORT}`);
});