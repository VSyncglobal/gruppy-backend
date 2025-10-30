import cron from "node-cron";
import { cleanupPendingPayments } from "./cleanupPendingPayments";
import { finalizeReadyPools } from "./finalizeReadyPools"; // ✨ ADD THIS IMPORT

export const startJobs = () => {
  // Runs every 15 minutes to clean up pending payments
  cron.schedule("*/15 * * * *", cleanupPendingPayments);

  // ✨ NEW: Runs at the top of every hour to finalize ready pools
  cron.schedule("0 * * * *", finalizeReadyPools);

  console.log("⏰ Cron jobs scheduled: Payment Cleanup & Pool Finalizer.");
};