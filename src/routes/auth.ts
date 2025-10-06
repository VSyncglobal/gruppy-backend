import { Router } from "express";
import { register, login } from "../controllers/auth";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/register", register);
router.post("/login", login);

// 🔒 Protected route (test token)
router.get("/me", authenticate, (req, res) => {
  res.json({
    message: "Protected route accessed!",
    user: (req as any).user,
  });
});

export default router;
