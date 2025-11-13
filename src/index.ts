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
import cookieParser from 'cookie-parser'; 

// Route Imports
import authRouter from './routes/auth';
import pricingRoutes from './routes/pricing';
import categoryRoutes from './routes/categoryRoutes';
import pricingLogRoutes from './routes/pricingLog';
import adminLogisticsRoutes from './routes/adminLogisticsRoutes'; 
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
import adminGlobalSettingsRoutes from './routes/adminGlobalSettingsRoutes';
import sourcingRoutes from './routes/sourcingRoutes';
import poolFinanceRoutes from './routes/poolFinanceRoutes';
import locationRoutes from "./routes/locationRoutes";
import deliveryRoutes from "./routes/deliveryRoutes";
import adminShipmentRoutes from "./routes/adminShipmentRoutes";
import adminBulkOrderRoutes from "./routes/adminBulkOrderRoutes"; // --- NEW (v_phase4) ---

// Job Scheduler
import { startJobs } from './jobs';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Core Middleware
app.set('trust proxy', 'loopback, linklocal, uniquelocal');
app.use(express.json());

// --- CORS Configuration ---
const allowedOrigins = [
  "http://localhost:3000",              // Local frontend
  "https://gruppy.store", // Production frontend
  "https://gruppy-backend.onrender.com" // Backend itself (Render)
];
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy does not allow access from origin ${origin}`));
    }
  },
  credentials: true, 
};
app.use(cors(corsOptions));
// --- End of CORS ---

app.use(helmet());
app.use(cookieParser()); 

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Database and Redis clients
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// API Routes
app.use('/health', healthRouter);
app.use('/api/auth', authRouter); 
app.use('/api/pricing', pricingRoutes);
app.use('/api/pricing/logs', pricingLogRoutes);
app.use('/api/admin/logistics-routes', adminLogisticsRoutes); 
app.use('/api/admin/tax', adminTaxRoutes);
app.use('/api/admin/payments', adminPaymentRoutes);
app.use('/api/users', userRoutes); 
app.use('/api/pools', poolRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/affiliates', adminAffiliateRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin/settings', adminGlobalSettingsRoutes);
app.use('/api/sourcing-requests', sourcingRoutes);
app.use('/api/admin/finance', poolFinanceRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/admin/shipments", adminShipmentRoutes);
app.use("/api/admin/bulk-orders", adminBulkOrderRoutes); // --- NEW (v_phase4) ---

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