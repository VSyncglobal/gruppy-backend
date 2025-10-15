import cron from "node-cron";
import { cleanupPendingPayments } from "./cleanupPendingPayments";

export const startJobs = () => {
  // Schedule the job to run every 15 minutes
  // The cron syntax '*/15 * * * *' means "at every 15th minute"
  cron.schedule("*/15 * * * *", cleanupPendingPayments);

  console.log("⏰ Cron jobs scheduled.");
};