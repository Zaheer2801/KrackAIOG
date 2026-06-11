import { Router } from "express";
import {
  login,
  getUserByToken,
  createPasscode,
  getPasscodes,
  updatePasscode,
  deletePasscode,
  resetDeviceFingerprint
} from "../controllers/user";
import { authenticate } from "../middlewares/auth";

const router = Router();

router.post("/login", login);
router.get("/user", authenticate, getUserByToken);

// Admin Routes
router.post("/admin/passcodes", authenticate, createPasscode);
router.get("/admin/passcodes", authenticate, getPasscodes);
router.put("/admin/passcodes/:id", authenticate, updatePasscode);
router.delete("/admin/passcodes/:id", authenticate, deletePasscode);
router.post("/admin/passcodes/:id/reset-device", authenticate, resetDeviceFingerprint);

export default router;
