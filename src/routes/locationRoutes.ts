// src/routes/locationRoutes.ts
import { Router } from "express";
import { getKenyanTowns } from "../controllers/locationController";

const router = Router();

/**
 * @route GET /api/locations/towns
 * @description Public route to get a list of all Kenyan towns.
 */
router.get("/towns", getKenyanTowns);

export default router;