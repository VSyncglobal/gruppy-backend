import * as Sentry from "@sentry/node";
import dotenv from "dotenv";

// Load environment variables to make SENTRY_DSN available
dotenv.config();

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // We recommend adjusting this value in production, or using tracesSampler
  // for finer control
  tracesSampleRate: 1.0,
});