"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interviewMeta = exports.interviewService = void 0;
const client_1 = require("@/infrastructure/prisma/client");
const ml_client_1 = require("@/infrastructure/ml/ml-client");
const app_error_1 = require("@/shared/errors/app-error");
const logger_1 = require("@/shared/logger/logger");
const question_bank_1 = require("@/modules/interview/domain/question-bank");
const scoring_service_1 = require("@/modules/scoring/application/scoring-service");
exports.interviewService = {
    async create(userId, input) {
        const questions = (0, question_bank_1.pickQuestions)(input.category);
        return client_1.prisma.$transaction(async (tx) => {
            const interview = await tx.interview.create({
                data: {
                    userId,
                    cvId: input.cvId ?? null,
                    role: input.role,
                    category: input.category,
                    language: input.language,
                    difficulty: input.difficulty,
                    persona: input.persona,
                    plannedSec: input.plannedSec,
                    status: "PENDING",
                },
            });
            await tx.question.createMany({
                data: questions.map((text, i) => ({
                    interviewId: interview.id,
                    ordinal: i,
                    text,
                    phase: (0, question_bank_1.phaseFor)(i, questions.length),
                })),
            });
            const full = await tx.interview.findUnique({
                where: { id: interview.id },
                include: { questions: { orderBy: { ordinal: "asc" } } },
            });
            return full;
        });
    },
    async list(userId, opts = {}) {
        return client_1.prisma.interview.findMany({
            where: { userId },
            include: { report: true },
            orderBy: { createdAt: "desc" },
            take: opts.limit ?? 50,
        });
    },
    async get(userId, id) {
        const iv = await client_1.prisma.interview.findFirst({
            where: { id, userId },
            include: {
                questions: {
                    orderBy: { ordinal: "asc" },
                    include: { answer: true },
                },
                report: true,
            },
        });
        if (!iv)
            throw app_error_1.AppError.notFound("Interview not found");
        return iv;
    },
    async start(userId, id) {
        const iv = await this.get(userId, id);
        if (iv.status === "COMPLETED")
            throw app_error_1.AppError.conflict("Interview already completed");
        if (iv.status === "LIVE")
            return iv;
        await client_1.prisma.interview.update({
            where: { id: iv.id },
            data: { status: "LIVE", startedAt: new Date() },
        });
        await client_1.prisma.interviewEvent.create({
            data: { interviewId: iv.id, type: "interview.started" },
        });
        return this.get(userId, id);
    },
    async submitAnswer(userId, id, input) {
        const iv = await this.get(userId, id);
        if (iv.status !== "LIVE")
            throw app_error_1.AppError.badRequest("Interview is not live");
        const q = iv.questions.find((q) => q.id === input.questionId);
        if (!q)
            throw app_error_1.AppError.notFound("Question not found");
        if (q.answer)
            throw app_error_1.AppError.conflict("Question already answered");
        const score = await ml_client_1.mlClient.scoreAnswer({
            question: q.text,
            transcript: input.transcript,
            language: iv.language,
        });
        const answer = await client_1.prisma.answer.create({
            data: {
                questionId: q.id,
                transcript: input.transcript,
                durationMs: input.durationMs ?? null,
                metrics: score,
                scoredAt: new Date(),
            },
        });
        return { answer, nextQuestion: nextOrdinal(iv.questions, q.ordinal) };
    },
    async end(userId, id, input) {
        const iv = await this.get(userId, id);
        if (iv.status === "COMPLETED")
            return iv;
        await client_1.prisma.interview.update({
            where: { id: iv.id },
            data: {
                status: input.abortReason ? "ABORTED" : "COMPLETED",
                endedAt: new Date(),
                abortReason: input.abortReason,
            },
        });
        await client_1.prisma.interviewEvent.create({
            data: {
                interviewId: iv.id,
                type: input.abortReason ? "interview.aborted" : "interview.completed",
                payload: input.abortReason ? { reason: input.abortReason } : undefined,
            },
        });
        await client_1.prisma.outboxEvent.create({
            data: {
                aggregate: "interview",
                aggregateId: iv.id,
                type: input.abortReason ? "interview.aborted" : "interview.completed",
                payload: { interviewId: iv.id, userId },
            },
        });
        // Synchronous report generation so the report is ready immediately on redirect
        try {
            await scoring_service_1.scoringService.generateReport(iv.id);
        }
        catch (err) {
            logger_1.logger.error({ err, interviewId: iv.id }, "Report generation failed");
        }
        return this.get(userId, id);
    },
};
function nextOrdinal(qs, current) {
    const sorted = [...qs].sort((a, b) => a.ordinal - b.ordinal);
    const next = sorted.find((q) => q.ordinal > current);
    return next ? next.ordinal : null;
}
exports.interviewMeta = {
    tracks: question_bank_1.TRACKS,
};
//# sourceMappingURL=interview-service.js.map