import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "@/http/middlewares/async-handler";
import { requireAuth } from "@/http/middlewares/auth";
import { cvService } from "@/modules/cv/application/cv-service";
import { env } from "@/shared/config/env";
import { AppError } from "@/shared/errors/app-error";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES },
});

export const cvRouter = Router();
cvRouter.use(requireAuth);

cvRouter.post(
  "/",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest("File is required");
    const cv = await cvService.upload(req.user!.sub, {
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
    });
    res.status(202).json({ cv });
  })
);

cvRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const cvs = await cvService.listForUser(req.user!.sub);
    res.json({ items: cvs });
  })
);

cvRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const cv = await cvService.getById(req.user!.sub, req.params.id);
    res.json({ cv });
  })
);

cvRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await cvService.delete(req.user!.sub, req.params.id);
    res.json({ ok: true });
  })
);
