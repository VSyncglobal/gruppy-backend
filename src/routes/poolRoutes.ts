import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  createPool,
  joinPool,
  getPools,
  getPoolById,
} from "../controllers/poolController";

const router = Router();

router.post("/", authenticate, createPool);
router.post("/join", authenticate, joinPool);
router.get("/", getPools);
router.get("/:id", getPoolById);

export default router;
