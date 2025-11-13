// src/middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';

/**
 * General limiter for most API routes.
 * (Moved from index.ts)
 */
export const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests, please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Stricter limiter for sensitive authentication routes.
 * (Moved from index.ts)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth attempts per 15 minutes
  message: "Too many authentication attempts, please try again in 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});