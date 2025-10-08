import { Router } from "express";
import { getFreightRates, addFreightRate } from "../controllers/freightController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, getFreightRates);
router.post("/", authenticate, addFreightRate);

export default router;
