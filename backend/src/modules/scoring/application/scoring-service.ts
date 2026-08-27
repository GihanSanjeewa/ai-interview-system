import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/prisma/client";
import {
  mlClient,
  MlServiceError,
  type AnswerScore,
} from "@/infrastructure/ml/ml-client";
import { AppError } from "@/shared/errors/app-error";
import { logger } from "@/shared/logger/logger";
import { jobsService } from "@/modules/jobs/application/jobs-service";

export const scoringService = {
  /**
   * Generate the performance report for a finished interview.
   *
   * Each answer is sent with its full question metadata — domain, difficulty,
   * and the concepts a good answer should cover — plus how long the candidate
   * spoke and how the turn was classified. The ML report generator needs all of
   * it: without `expects` it cannot measure concept coverage, without
   * `durationMs` it cannot compute real words-per-minute, and without `intent`
   * it cannot tell a declined question from a wrong answer.
   */
  async generateReport(interviewId: string) {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        questions: { include: { answer: true }, orderBy: { ordinal: "asc" } },
      },
    });
    if (!interview) throw AppError.notFound("Interview not found");

    const answered = interview.questions
      .filter((q) => q.answer)
      .map((q) => ({
        question: {
          ordinal: q.ordinal,
          text: q.text,
          phase: q.phase,
          domain: q.domain ?? "",
          difficulty: q.difficulty ?? "Intermediate",
          source: q.source ?? "dataset",
          expects: Array.isArray(q.expects) ? (q.expects as string[]) : [],
        },
        transcript: q.answer!.transcript ?? "",
        metrics: (q.answer!.metrics as unknown as AnswerScore) ?? null,
        durationMs: q.answer!.durationMs,
        intent: q.answer!.intent,
      }));

    let session;
    try {
      session = await mlClient.scoreSession({
        answers: answered,
        role: interview.role,
        track: interview.category,
        language: interview.language,
      });
    } catch (err) {
      // A report built from invented numbers is worse than no report, so the
      // failure is recorded and surfaced instead of being papered over.
      logger.error({ err, interviewId }, "Session scoring failed");
      await prisma.interviewEvent.create({
        data: {
          interviewId,
          type: "report.failed",
          payload: { reason: err instanceof MlServiceError ? err.message : String(err) },
        },
      });
      throw err instanceof MlServiceError
        ? AppError.serviceUnavailable(
            "The scoring service is unavailable, so the report could not be " +
              "generated yet. Your answers are saved — reopen the report shortly.",
          )
        : err;
    }

    const scores = {
      overallScore: Math.round(session.overallScore),
      confidence: Math.round(session.confidence),
      communication: Math.round(session.communication),
      relevance: Math.round(session.relevance),
      technical: Math.round(session.technical),
      fluency: Math.round(session.fluency),
      // `pace` is stored as an Int; keep it as measured words-per-minute when
      // audio was available, falling back to the 0-100 pace score.
      pace: Math.round(session.paceWpm ?? session.paceScore ?? 0),
      performanceLevel: session.performanceLevel,
      strengths: session.strengths as unknown as Prisma.InputJsonValue,
      weaknesses: session.weaknesses as unknown as Prisma.InputJsonValue,
      suggestions: session.suggestions as unknown as Prisma.InputJsonValue,
      resources: session.resources as unknown as Prisma.InputJsonValue,
      analytics: session.analytics as unknown as Prisma.InputJsonValue,
      perQuestion: session.perQuestion as unknown as Prisma.InputJsonValue,
      diagnosis: session.diagnosis as unknown as Prisma.InputJsonValue,
    };

    const report = await prisma.report.upsert({
      where: { interviewId: interview.id },
      update: { ...scores, generatedAt: new Date() },
      create: {
        interviewId: interview.id,
        userId: interview.userId,
        ...scores,
      },
    });

    await jobsService.matchForReport(report.id);
    return report;
  },

  async getReport(userId: string, interviewId: string) {
    const report = await prisma.report.findFirst({
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
              select: {
                id: true,
                ordinal: true,
                text: true,
                phase: true,
                domain: true,
                difficulty: true,
                source: true,
                answer: {
                  select: {
                    transcript: true,
                    metrics: true,
                    durationMs: true,
                    intent: true,
                    skipped: true,
                  },
                },
              },
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
    if (!report) throw AppError.notFound("Report not found");
    return report;
  },

  async listForUser(userId: string) {
    return prisma.report.findMany({
      where: { userId },
      include: {
        interview: { select: { role: true, category: true, createdAt: true } },
      },
      orderBy: { generatedAt: "desc" },
      take: 50,
    });
  },
};
