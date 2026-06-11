import { Router } from "express";
import {
  createAccessRequest,
  getAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  updateAccessRequest,
  getUserInterviews,
} from "../controllers/access";
import { authenticate } from "../middlewares/auth";

const router = Router();

// Public
router.post("/access-request", createAccessRequest);
router.post("/api/access-request", createAccessRequest);

// Admin
router.get("/admin/access-requests", authenticate, getAccessRequests);
router.patch("/admin/access-requests/:id", authenticate, updateAccessRequest);
router.post("/admin/access-requests/:id/approve", authenticate, approveAccessRequest);
router.post("/admin/access-requests/:id/reject", authenticate, rejectAccessRequest);
router.get("/admin/users/:id/interviews", authenticate, getUserInterviews);

export default router;
