import { prisma } from "@/infrastructure/prisma/client";
import { mlClient } from "@/infrastructure/ml/ml-client";
import { AppError } from "@/shared/errors/app-error";
import { logger } from "@/shared/logger/logger";
import {
  phaseFor,
  pickQuestions,
  TRACKS,
} from "@/modules/interview/domain/question-bank";
import type {
  CreateInterviewInput,
  SubmitAnswerInput,
  EndInterviewInput,
} from "@/modules/interview/presentation/dto";
import { scoringService } from "@/modules/scoring/application/scoring-service";

export const interviewService = {
  async create(userId: string, input: CreateInterviewInput) {
    const questions = pickQuestions(input.category);
    return prisma.$transaction(async (tx) => {
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
          phase: phaseFor(i, questions.length),
        })),
      });
      const full = await tx.interview.findUnique({
        where: { id: interview.id },
        include: { questions: { orderBy: { ordinal: "asc" } } },
      });
      return full!;
    });
  },

  async list(userId: string, opts: { limit?: number } = {}) {
    return prisma.interview.findMany({
      where: { userId },
      include: { report: true },
      orderBy: { createdAt: "desc" },
      take: opts.limit ?? 50,
    });
  },

  async get(userId: string, id: string) {
    const iv = await prisma.interview.findFirst({
      where: { id, userId },
      include: {
        questions: {
          orderBy: { ordinal: "asc" },
          include: { answer: true },
        },
        report: true,
      },
    });
    if (!iv) throw AppError.notFound("Interview not found");
    return iv;
  },

  async start(userId: string, id: string) {
    const iv = await this.get(userId, id);
    if (iv.status === "COMPLETED") throw AppError.conflict("Interview already completed");
    if (iv.status === "LIVE") return iv;
    await prisma.interview.update({
      where: { id: iv.id },
      data: { status: "LIVE", startedAt: new Date() },
    });
    await prisma.interviewEvent.create({
      data: { interviewId: iv.id, type: "interview.started" },
    });
    return this.get(userId, id);
  },

  async submitAnswer(userId: string, id: string, input: SubmitAnswerInput) {
    const iv = await this.get(userId, id);
    if (iv.status !== "LIVE") throw AppError.badRequest("Interview is not live");
    const q = iv.questions.find((q) => q.id === input.questionId);
    if (!q) throw AppError.notFound("Question not found");
    if (q.answer) throw AppError.conflict("Question already answered");

    const score = await mlClient.scoreAnswer({
      question: q.text,
      transcript: input.transcript,
      language: iv.language,
    });

    const answer = await prisma.answer.create({
      data: {
        questionId: q.id,
        transcript: input.transcript,
        durationMs: input.durationMs ?? null,
        metrics: score as unknown as object,
        scoredAt: new Date(),
      },
    });
    return { answer, nextQuestion: nextOrdinal(iv.questions, q.ordinal) };
  },

  async end(userId: string, id: string, input: EndInterviewInput) {
    const iv = await this.get(userId, id);
    if (iv.status === "COMPLETED") return iv;
    await prisma.interview.update({
      where: { id: iv.id },
      data: {
        status: input.abortReason ? "ABORTED" : "COMPLETED",
        endedAt: new Date(),
        abortReason: input.abortReason,
      },
    });
    await prisma.interviewEvent.create({
      data: {
        interviewId: iv.id,
        type: input.abortReason ? "interview.aborted" : "interview.completed",
        payload: input.abortReason ? { reason: input.abortReason } : undefined,
      },
    });
    await prisma.outboxEvent.create({
      data: {
        aggregate: "interview",
        aggregateId: iv.id,
        type: input.abortReason ? "interview.aborted" : "interview.completed",
        payload: { interviewId: iv.id, userId },
      },
    });
    // Inline scoring (synchronous) — replace with worker in Phase 2.
    void scoringService.generateReport(iv.id).catch((err) => {
      logger.error({ err, interviewId: iv.id }, "Report generation failed");
    });
    return this.get(userId, id);
  },
};

function nextOrdinal<T extends { ordinal: number }>(qs: T[], current: number) {
  const sorted = [...qs].sort((a, b) => a.ordinal - b.ordinal);
  const next = sorted.find((q) => q.ordinal > current);
  return next ? next.ordinal : null;
}

export const interviewMeta = {
  tracks: TRACKS,
};
