import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import {
  getFreightRates,
  createFreightRate,
  updateFreightRate,
  deleteFreightRate,
} from "../controllers/freightController";

const router = Router();

router.use(authenticate, requireAdmin);
router.get("/", getFreightRates);
router.post("/", createFreightRate);
router.put("/:id", updateFreightRate);
router.delete("/:id", deleteFreightRate);

export default router;
