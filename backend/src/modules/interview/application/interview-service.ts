import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/prisma/client";
import {
  mlClient,
  MlServiceError,
  type AnswerScore,
  type AudioMetrics,
  type InterviewProfile,
  type PlannedQuestion,
  type TurnDecision,
} from "@/infrastructure/ml/ml-client";
import { AppError } from "@/shared/errors/app-error";
import { logger } from "@/shared/logger/logger";
import { TRACKS } from "@/modules/interview/domain/question-bank";
import type {
  CreateInterviewInput,
  SubmitAnswerInput,
  EndInterviewInput,
} from "@/modules/interview/presentation/dto";
import { scoringService } from "@/modules/scoring/application/scoring-service";

/** Interview length, in questions, derived from the requested duration. */
function plannedQuestionCount(plannedSec: number | null | undefined): number {
  // ~3 minutes per question including the interviewer speaking and follow-ups.
  const minutes = (plannedSec ?? 20 * 60) / 60;
  return Math.max(4, Math.min(16, Math.round(minutes / 3)));
}

/**
 * Build the ML planner's candidate profile from a stored CV.
 *
 * Returns an empty profile when there is no CV. The planner then omits the
 * CV-grounded questions entirely rather than asking about a degree or project
 * the candidate never claimed.
 */
async function profileForCv(
  cvId: string | null | undefined,
  role: string,
): Promise<InterviewProfile> {
  if (!cvId) return { role };
  const cv = await prisma.cv.findUnique({ where: { id: cvId } });
  if (!cv || cv.status !== "PARSED") return { role };

  const parsed = (cv.parsed ?? {}) as Record<string, unknown>;
  const arr = (key: string): string[] =>
    Array.isArray(parsed[key]) ? (parsed[key] as string[]) : [];

  return {
    role,
    technologies: arr("technologies"),
    skills: arr("skills"),
    demonstratedTechnologies: arr("demonstratedTechnologies"),
    education: arr("education"),
    experience: arr("experience"),
    certifications: arr("certifications"),
    projects: arr("projects"),
    yearsTotal:
      typeof parsed.yearsTotal === "number" ? (parsed.yearsTotal as number) : null,
  };
}

export const interviewService = {
  /**
   * Create an interview with a plan generated from the candidate's CV.
   *
   * Questions come from the ML planner, which retrieves from the project's own
   * labelled question dataset and grounds the opening questions in this
   * candidate's actual experience. There is no static question bank.
   */
  async create(userId: string, input: CreateInterviewInput) {
    const profile = await profileForCv(input.cvId, input.role);
    const total = plannedQuestionCount(input.plannedSec);

    let plan;
    try {
      plan = await mlClient.planInterview({
        profile,
        role: input.role,
        track: input.category,
        difficulty: input.difficulty,
        total,
      });
    } catch (err) {
      if (err instanceof MlServiceError) {
        logger.error({ err, userId }, "Interview planning unavailable");
        throw AppError.serviceUnavailable(
          "The interview planner is unavailable, so no questions could be " +
            "prepared. Please try again in a moment.",
        );
      }
      throw err;
    }

    return prisma.$transaction(async (tx) => {
      const interview = await tx.interview.create({
        data: {
          userId,
          cvId: input.cvId ?? null,
          role: input.role,
          category: plan.track,
          language: input.language,
          difficulty: input.difficulty,
          persona: input.persona,
          plannedSec: input.plannedSec,
          status: "PENDING",
        },
      });
      await tx.question.createMany({
        data: plan.questions.map((q) => ({
          interviewId: interview.id,
          ordinal: q.ordinal,
          text: q.text,
          phase: q.phase,
          domain: q.domain,
          difficulty: q.difficulty,
          source: q.source,
          expects: q.expects as unknown as Prisma.InputJsonValue,
        })),
      });
      await tx.interviewEvent.create({
        data: {
          interviewId: interview.id,
          type: "interview.planned",
          payload: {
            track: plan.track,
            poolSize: plan.poolSize,
            cvGrounded: plan.cvGrounded,
            questionCount: plan.questions.length,
          },
        },
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

  /**
   * Record an answer and decide what the interviewer does next.
   *
   * This is the conversational core. The answer is scored, then classified:
   *  - "I don't know" / silence  → acknowledged and skipped, not marked wrong
   *  - a shallow answer          → one follow-up probe, then move on
   *  - a strong answer           → a deeper probe to find the ceiling
   *  - two gaps in a row         → an easier question in the same area
   *  - "can you repeat that"     → the same question again
   *
   * Follow-up and easier questions are appended to the plan on the fly, so the
   * question list genuinely adapts to the conversation.
   */
  async submitAnswer(userId: string, id: string, input: SubmitAnswerInput) {
    const iv = await this.get(userId, id);
    if (iv.status !== "LIVE") throw AppError.badRequest("Interview is not live");
    const q = iv.questions.find((q) => q.id === input.questionId);
    if (!q) throw AppError.notFound("Question not found");
    if (q.answer) throw AppError.conflict("Question already answered");

    const questionPayload: PlannedQuestion = {
      ordinal: q.ordinal,
      text: q.text,
      phase: q.phase,
      domain: q.domain ?? "",
      difficulty: q.difficulty ?? "Intermediate",
      source: q.source ?? "dataset",
      expects: Array.isArray(q.expects) ? (q.expects as string[]) : [],
    };

    const audio = (input.audio ?? null) as AudioMetrics | null;

    // 1. Score the answer, with measured acoustics when the client sent them.
    let score: AnswerScore | null = null;
    try {
      score = await mlClient.scoreAnswer({
        question: questionPayload,
        transcript: input.transcript,
        language: iv.language,
        audio,
        domain: questionPayload.domain,
      });
    } catch (err) {
      // Scoring can be recovered at report time; the interview must continue.
      logger.warn({ err, interviewId: iv.id }, "Live answer scoring failed");
    }

    // 2. Decide the interviewer's next move.
    const profile = await profileForCv(iv.cvId, iv.role);
    const history = iv.questions
      .filter((other) => other.answer)
      .map((other) => ({
        intent: other.answer?.intent ?? undefined,
        question: other.text,
      }));
    const unanswered = iv.questions.filter((other) => !other.answer && other.id !== q.id);
    const followupsUsed = iv.questions.filter((other) => other.source === "followup").length;

    const decision: TurnDecision = await mlClient.nextTurn({
      question: questionPayload,
      answer: input.transcript,
      answerScore: score ?? undefined,
      history,
      profile,
      track: iv.category,
      difficulty: iv.difficulty,
      followupsUsed,
      remaining: unanswered.length,
    });

    // 3. "Repeat that" / nothing captured: re-ask without consuming the
    //    question, so no answer row is written for a turn that never happened.
    if (decision.action === "repeat") {
      await prisma.interviewEvent.create({
        data: {
          interviewId: iv.id,
          type: "answer.repeat",
          payload: {
            questionOrdinal: q.ordinal,
            intent: decision.intent,
            note: decision.note,
          },
        },
      });
      return {
        answer: null,
        say: decision.say,
        action: decision.action,
        intent: decision.intent,
        skipped: decision.skipped,
        repeatQuestion: {
          id: q.id,
          ordinal: q.ordinal,
          text: q.text,
          phase: q.phase,
          domain: q.domain,
          difficulty: q.difficulty,
        },
        nextQuestion: null,
        newQuestion: null,
      };
    }

    // 4. Persist the answer together with how the turn was classified.
    const answer = await prisma.answer.create({
      data: {
        questionId: q.id,
        transcript: input.transcript,
        durationMs: input.durationMs ?? null,
        metrics: (score ?? undefined) as unknown as Prisma.InputJsonValue,
        intent: decision.intent,
        skipped: decision.skipped,
        scoredAt: score ? new Date() : null,
      },
    });

    await prisma.interviewEvent.create({
      data: {
        interviewId: iv.id,
        type: "answer.turn",
        payload: {
          questionOrdinal: q.ordinal,
          intent: decision.intent,
          action: decision.action,
          skipped: decision.skipped,
          note: decision.note,
        },
      },
    });

    // 5. Follow-up / easier questions are inserted into the plan now.
    let newQuestion = null;
    if ((decision.action === "followup" || decision.action === "easier") && decision.followup) {
      const maxOrdinal = Math.max(...iv.questions.map((other) => other.ordinal));
      const created = await prisma.question.create({
        data: {
          interviewId: iv.id,
          // Placed immediately next so the probe follows its own answer.
          ordinal: maxOrdinal + 1,
          text: decision.followup.text,
          phase: decision.followup.phase,
          domain: decision.followup.domain,
          difficulty: decision.followup.difficulty,
          source: decision.action === "followup" ? "followup" : "adaptive_easier",
          expects: decision.followup.expects as unknown as Prisma.InputJsonValue,
        },
      });
      newQuestion = {
        id: created.id,
        ordinal: created.ordinal,
        text: created.text,
        phase: created.phase,
        domain: created.domain,
        difficulty: created.difficulty,
      };
    }

    // 6. Otherwise advance to the next unanswered question in the plan.
    const next = newQuestion
      ? null
      : unanswered.sort((a, b) => a.ordinal - b.ordinal)[0] ?? null;

    return {
      answer,
      say: decision.say,
      action: decision.action,
      intent: decision.intent,
      skipped: decision.skipped,
      repeatQuestion: null,
      newQuestion,
      nextQuestion: next
        ? {
            id: next.id,
            ordinal: next.ordinal,
            text: next.text,
            phase: next.phase,
            domain: next.domain,
            difficulty: next.difficulty,
          }
        : null,
    };
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
    // Synchronous report generation so the report is ready on redirect.
    try {
      await scoringService.generateReport(iv.id);
    } catch (err) {
      logger.error({ err, interviewId: iv.id }, "Report generation failed");
    }
    return this.get(userId, id);
  },
};

export const interviewMeta = {
  tracks: TRACKS,
};
