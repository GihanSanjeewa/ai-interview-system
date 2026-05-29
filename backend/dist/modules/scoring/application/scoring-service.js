"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoringService = void 0;
const client_1 = require("@/infrastructure/prisma/client");
const ml_client_1 = require("@/infrastructure/ml/ml-client");
const app_error_1 = require("@/shared/errors/app-error");
const jobs_service_1 = require("@/modules/jobs/application/jobs-service");
exports.scoringService = {
    async generateReport(interviewId) {
        const interview = await client_1.prisma.interview.findUnique({
            where: { id: interviewId },
            include: {
                questions: { include: { answer: true }, orderBy: { ordinal: "asc" } },
            },
        });
        if (!interview)
            throw app_error_1.AppError.notFound("Interview not found");
        const answered = interview.questions
            .filter((q) => q.answer)
            .map((q) => ({
            question: q.text,
            transcript: q.answer.transcript ?? "",
            metrics: q.answer.metrics ?? undefined,
        }));
        const session = await ml_client_1.mlClient.scoreSession({
            answers: answered,
            role: interview.role,
            language: interview.language,
        });
        const report = await client_1.prisma.report.upsert({
            where: { interviewId: interview.id },
            update: {
                overallScore: session.overallScore,
                confidence: session.confidence,
                communication: session.communication,
                relevance: session.relevance,
                technical: session.technical,
                fluency: session.fluency,
                pace: session.pace,
                performanceLevel: session.performanceLevel,
                strengths: session.strengths,
                weaknesses: session.weaknesses,
                suggestions: session.suggestions,
                resources: session.resources,
                generatedAt: new Date(),
            },
            create: {
                interviewId: interview.id,
                userId: interview.userId,
                overallScore: session.overallScore,
                confidence: session.confidence,
                communication: session.communication,
                relevance: session.relevance,
                technical: session.technical,
                fluency: session.fluency,
                pace: session.pace,
                performanceLevel: session.performanceLevel,
                strengths: session.strengths,
                weaknesses: session.weaknesses,
                suggestions: session.suggestions,
                resources: session.resources,
            },
        });
        await jobs_service_1.jobsService.matchForReport(report.id);
        return report;
    },
    async getReport(userId, interviewId) {
        const report = await client_1.prisma.report.findFirst({
            where: { interviewId, userId },
            include: {
                interview: {
                    select: {
                        role: true,
                        category: true,
                        difficulty: true,
                        language: true,
                        persona: true,
                        createdAt: true,
                        startedAt: true,
                        endedAt: true,
                        questions: {
                            include: { answer: { select: { transcript: true, metrics: true } } },
                            orderBy: { ordinal: "asc" },
                        },
                    },
                },
                jobMatches: {
                    include: { job: true },
                    orderBy: { matchScore: "desc" },
                    take: 10,
                },
            },
        });
        if (!report)
            throw app_error_1.AppError.notFound("Report not found");
        return report;
    },
    async listForUser(userId) {
        return client_1.prisma.report.findMany({
            where: { userId },
            include: {
                interview: { select: { role: true, category: true, createdAt: true } },
            },
            orderBy: { generatedAt: "desc" },
            take: 50,
        });
    },
};
//# sourceMappingURL=scoring-service.js.map