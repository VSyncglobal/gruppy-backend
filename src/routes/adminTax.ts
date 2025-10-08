import { Router } from "express";
import { getTaxRates, addTaxRate, updateTaxRate } from "../controllers/taxController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, getTaxRates);
router.post("/", authenticate, addTaxRate);
router.put("/:id", authenticate, updateTaxRate);

export default router;
