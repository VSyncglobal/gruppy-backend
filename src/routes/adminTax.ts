import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import {
  getTaxRates,
  createTaxRate,
  updateTaxRate,
  deleteTaxRate,
} from "../controllers/taxController";

const router = Router();

router.use(authenticate, requireAdmin);
router.get("/", getTaxRates);
router.post("/", createTaxRate);
router.put("/:id", updateTaxRate);
router.delete("/:id", deleteTaxRate);

export default router;
