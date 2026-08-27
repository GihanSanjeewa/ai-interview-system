import { Router } from "express";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import { v4 as uuid } from "uuid";
import { asyncHandler } from "@/http/middlewares/async-handler";
import { requireAuth } from "@/http/middlewares/auth";
import { mlClient } from "@/infrastructure/ml/ml-client";
import { env } from "@/shared/config/env";
import { AppError } from "@/shared/errors/app-error";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

export const audioRouter = Router();

// Public probe — used by the frontend to show the "Fine-tuned Sinhala" badge
audioRouter.get(
  "/whisper/info",
  asyncHandler(async (_req, res) => {
    const info = await mlClient.whisperInfo();
    res.json({ info });
  })
);

audioRouter.use(requireAuth);

audioRouter.post(
  "/transcribe",
  upload.single("audio"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest("audio is required");
    const language = (req.body?.language as string) || "en";

    const dir = path.join(env.UPLOAD_DIR, "audio", req.user!.sub);
    await fs.mkdir(dir, { recursive: true });
    const tmp = path.join(dir, `${uuid()}-${req.file.originalname || "blob.webm"}`);
    await fs.writeFile(tmp, req.file.buffer);

    // `metrics` carries the librosa acoustic measurements (pace, vocal
    // confidence, fluency). The client sends them back with the answer so
    // those three scores are measured rather than assumed — previously they
    // were computed here and discarded.
    const { text, audio, whisper } = await mlClient.transcribe(tmp, language);
    res.json({ text, metrics: audio, whisper });
  })
);
