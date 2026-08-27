import { Prisma } from "@prisma/client";
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

  /**
   * Parse and analyse the CV.
   *
   * The full analysis is stored, including the diagnostics: which sections were
   * found, how confident the extraction was, and what the analyser could NOT
   * find. The interview planner reads `projects`, `demonstratedTechnologies` and
   * `contact`, and the UI uses `warnings` to tell the user how to improve their
   * CV rather than silently showing invented fields.
   */
  async parseInBackground(cvId: string, absPath: string) {
    try {
      const parsed = await mlClient.parseCv(absPath);
      await prisma.cv.update({
        where: { id: cvId },
        data: {
          status: "PARSED",
          rawText: parsed.rawText?.slice(0, 200_000),
          // Cast to Prisma's JSON input type: the analyser returns typed
          // interfaces, which are structurally valid JSON but lack the index
          // signature Prisma's InputJsonObject requires.
          parsed: {
            contact: parsed.contact,
            skills: parsed.skills,
            technologies: parsed.technologies,
            demonstratedTechnologies: parsed.demonstratedTechnologies,
            education: parsed.education,
            educationDetail: parsed.educationDetail,
            experience: parsed.experience,
            experienceDetail: parsed.experienceDetail,
            certifications: parsed.certifications,
            projects: parsed.projects,
            // null when the CV states no dates — the UI shows "not stated"
            // rather than a fabricated figure.
            yearsTotal: parsed.yearsTotal,
            seniority: parsed.seniority,
            readinessBreakdown: parsed.readinessBreakdown,
            trackAnalysis: parsed.trackAnalysis,
            sectionsFound: parsed.sectionsFound,
            extractionConfidence: parsed.extractionConfidence,
            warnings: parsed.warnings,
          } as unknown as Prisma.InputJsonValue,
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
