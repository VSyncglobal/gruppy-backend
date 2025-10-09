import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  createFreightRate,
  getFreightRates,
  updateFreightRate,
  deleteFreightRate,
} from "../controllers/freightController";

const router = Router();

// ✅ All freight routes require authentication
router.use(authenticate);

// ✅ CRUD routes for Freight Rates
router.post("/", createFreightRate);
router.get("/", getFreightRates);
router.put("/:id", updateFreightRate);
router.delete("/:id", deleteFreightRate);

export default router;
