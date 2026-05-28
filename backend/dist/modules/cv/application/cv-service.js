"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cvService = void 0;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const uuid_1 = require("uuid");
const client_1 = require("@/infrastructure/prisma/client");
const ml_client_1 = require("@/infrastructure/ml/ml-client");
const env_1 = require("@/shared/config/env");
const app_error_1 = require("@/shared/errors/app-error");
const logger_1 = require("@/shared/logger/logger");
const ALLOWED_MIMES = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
exports.cvService = {
    async upload(userId, file) {
        if (!ALLOWED_MIMES.has(file.mimeType)) {
            throw app_error_1.AppError.badRequest("Only PDF / DOCX files are supported");
        }
        if (file.sizeBytes > env_1.env.MAX_UPLOAD_BYTES) {
            throw app_error_1.AppError.badRequest("File exceeds size limit");
        }
        await promises_1.default.mkdir(env_1.env.UPLOAD_DIR, { recursive: true });
        const fileKey = `${userId}/${(0, uuid_1.v4)()}-${file.originalName}`;
        const absPath = node_path_1.default.join(env_1.env.UPLOAD_DIR, fileKey);
        await promises_1.default.mkdir(node_path_1.default.dirname(absPath), { recursive: true });
        await promises_1.default.writeFile(absPath, file.buffer);
        const cv = await client_1.prisma.cv.create({
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
    async parseInBackground(cvId, absPath) {
        try {
            const parsed = await ml_client_1.mlClient.parseCv(absPath);
            await client_1.prisma.cv.update({
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
        }
        catch (err) {
            logger_1.logger.error({ err, cvId }, "CV parsing failed");
            await client_1.prisma.cv.update({
                where: { id: cvId },
                data: { status: "FAILED", errorMessage: err.message },
            });
        }
    },
    async listForUser(userId) {
        return client_1.prisma.cv.findMany({
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
    async getById(userId, id) {
        const cv = await client_1.prisma.cv.findFirst({ where: { id, userId } });
        if (!cv)
            throw app_error_1.AppError.notFound("CV not found");
        return cv;
    },
    async delete(userId, id) {
        const cv = await this.getById(userId, id);
        await client_1.prisma.cv.delete({ where: { id: cv.id } });
        try {
            await promises_1.default.unlink(node_path_1.default.join(env_1.env.UPLOAD_DIR, cv.fileKey));
        }
        catch {
            // ignore
        }
    },
};
//# sourceMappingURL=cv-service.js.map