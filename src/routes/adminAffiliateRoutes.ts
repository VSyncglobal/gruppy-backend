import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { createAffiliate, getAllAffiliates } from "../controllers/adminController";
import { validate } from "../middleware/validate";
import { createAffiliateSchema } from "../schemas/adminSchemas";

const router = Router();

// Protect all routes in this file
router.use(authenticate, requireAdmin);

// POST /api/admin/affiliates
router.post("/", validate(createAffiliateSchema), createAffiliate);

// GET /api/admin/affiliates
router.get("/", getAllAffiliates);

export default router;