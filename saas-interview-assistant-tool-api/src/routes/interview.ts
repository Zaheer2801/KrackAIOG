import { Router } from "express";
import {
  uploadResume,
  generateAnswer,
  generateGreeting,
  generateGlossary,
  generateTrainingQuestions,
  buildAgentBrain,
  generateInterviewPrep,
  createInterview,
  deleteInterviewById,
  fetchInterviews,
  getInterviewById,
  processCaptures,
  deductPartialTime,
  getAdminUserInterviews,
} from "../controllers/interview";
import { authenticate } from "../middlewares/auth";

const router = Router();

router.post('/process-captures', authenticate, processCaptures);
router.post("/upload-resume", authenticate, uploadResume);
router.post("/generate-answer", authenticate, generateAnswer);
router.post("/generate-greeting", authenticate, generateGreeting);
router.post("/generate-glossary", authenticate, generateGlossary);
router.post("/generate-training-questions", authenticate, generateTrainingQuestions);
router.post("/build-agent-brain", authenticate, buildAgentBrain);
router.post("/generate-interview-prep", authenticate, generateInterviewPrep);
router.post("/interview", authenticate, createInterview);
router.get("/interviews", authenticate, fetchInterviews);
router.delete("/interview/:id", authenticate, deleteInterviewById);
router.get("/interview/:id", authenticate, getInterviewById);
router.post("/deduct-partial", authenticate, deductPartialTime);
router.get("/admin/users/:userId/interviews", authenticate, getAdminUserInterviews);

export default router;
