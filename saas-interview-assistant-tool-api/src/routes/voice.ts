/**
 * VOICE CLONING ROUTES — IN-DEVELOPMENT, HIDDEN BY DEFAULT.
 * All routes are prefixed /dev/voice and gated by requireVoiceCloneFlag,
 * which 404s unless ENABLE_VOICE_CLONE === "true". Safe to mount in production:
 * with the flag off, these endpoints simply don't exist to any caller.
 */
import { Router } from "express";
import multer from "multer";
import { tmpdir } from "os";
import path from "path";
import { authenticate } from "../middlewares/auth";
import {
  requireVoiceCloneFlag,
  cloneVoice,
  speakInVoice,
  verifyClone,
  deleteVoice,
} from "../controllers/voiceClone";

// Dedicated audio upload (the shared `upload` middleware only allows images)
const audioStorage = multer.diskStorage({
  destination: tmpdir(),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".webm";
    cb(null, `voice-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const audioUpload = multer({
  storage: audioStorage,
  limits: { fileSize: 15 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const ok = ["audio/webm", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/ogg"];
    cb(null, ok.includes(file.mimetype));
  },
});

const router = Router();

router.post("/dev/voice/clone", requireVoiceCloneFlag, authenticate, audioUpload.array("samples"), cloneVoice);
router.post("/dev/voice/speak", requireVoiceCloneFlag, authenticate, speakInVoice);
router.post("/dev/voice/verify", requireVoiceCloneFlag, authenticate, verifyClone);
router.delete("/dev/voice/:voiceId", requireVoiceCloneFlag, authenticate, deleteVoice);

export default router;
