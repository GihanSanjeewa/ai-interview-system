import fs from "node:fs/promises";
import path from "node:path";
import { v4 as uuid } from "uuid";
import { prisma } from "@/infrastructure/prisma/client";
import { mlClient } from "@/infrastructure/ml/ml-client";
import { env } from "@/shared/config/env";
import { AppError } from "@/shared/errors/app-error";
import { logger } from "@/shared/logger/logger";

export interface UploadedCv {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const cvService = {
  async upload(userId: string, file: UploadedCv) {
    if (!ALLOWED_MIMES.has(file.mimeType)) {
      throw AppError.badRequest("Only PDF / DOCX files are supported");
    }
    if (file.sizeBytes > env.MAX_UPLOAD_BYTES) {
      throw AppError.badRequest("File exceeds size limit");
    }

    await fs.mkdir(env.UPLOAD_DIR, { recursive: true });
    const fileKey = `${userId}/${uuid()}-${file.originalName}`;
    const absPath = path.join(env.UPLOAD_DIR, fileKey);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, file.buffer);

    const cv = await prisma.cv.create({
      data: {
        userId,
        fileKey,
        originalName: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        status: "PENDING",
      },
    });

    // Kick off parse asynchronously — caller doesn't wait.
    void this.parseInBackground(cv.id, absPath);
    return cv;
  },

  async parseInBackground(cvId: string, absPath: string) {
    try {
      const parsed = await mlClient.parseCv(absPath);
      await prisma.cv.update({
        where: { id: cvId },
        data: {
          status: "PARSED",
          rawText: parsed.rawText?.slice(0, 200_000),
          parsed: {
            skills: parsed.skills,
            education: parsed.education,
            experience: parsed.experience,
            certifications: parsed.certifications,
            technologies: parsed.technologies,
            yearsTotal: parsed.yearsTotal ?? null,
          },
          readinessScore: parsed.readinessScore,
          suggestedTracks: parsed.suggestedTracks,
        },
      });
    } catch (err) {
      logger.error({ err, cvId }, "CV parsing failed");
      await prisma.cv.update({
        where: { id: cvId },
        data: { status: "FAILED", errorMessage: (err as Error).message },
      });
    }
  },

  async listForUser(userId: string) {
    return prisma.cv.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        originalName: true,
        status: true,
        mimeType: true,
        sizeBytes: true,
        readinessScore: true,
        suggestedTracks: true,
        parsed: true,
        createdAt: true,
      },
    });
  },

  async getById(userId: string, id: string) {
    const cv = await prisma.cv.findFirst({ where: { id, userId } });
    if (!cv) throw AppError.notFound("CV not found");
    return cv;
  },

  async delete(userId: string, id: string) {
    const cv = await this.getById(userId, id);
    await prisma.cv.delete({ where: { id: cv.id } });
    try {
      await fs.unlink(path.join(env.UPLOAD_DIR, cv.fileKey));
    } catch {
      // ignore
    }
  },
};
