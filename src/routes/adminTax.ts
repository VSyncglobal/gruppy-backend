import { Router } from "express";
import { getTaxRates, addTaxRate, updateTaxRate } from "../controllers/taxController";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { kraRateSchema } from "../schemas/adminSchemas";

const router = Router();

router.get("/", authenticate, getTaxRates);
router.post("/", validate(kraRateSchema), addTaxRate);
router.put("/:id", validate(kraRateSchema), updateTaxRate);

export default router;
