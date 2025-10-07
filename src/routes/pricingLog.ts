import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getAllLogs, getUserLogs } from "../controllers/pricingLogController";

const router = Router();

// Admin can see all logs
router.get("/all", authenticate, getAllLogs);

// Users see only their logs
router.get("/", authenticate, getUserLogs);

export default router;
