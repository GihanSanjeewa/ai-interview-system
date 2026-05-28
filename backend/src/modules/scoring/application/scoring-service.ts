import { prisma } from "@/infrastructure/prisma/client";
import { mlClient, type AnswerScore } from "@/infrastructure/ml/ml-client";
import { AppError } from "@/shared/errors/app-error";
import { jobsService } from "@/modules/jobs/application/jobs-service";

export const scoringService = {
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
        question: q.text,
        transcript: q.answer!.transcript ?? "",
        metrics: (q.answer!.metrics as unknown as AnswerScore) ?? undefined,
      }));

    const session = await mlClient.scoreSession({
      answers: answered,
      role: interview.role,
      language: interview.language,
    });

    const report = await prisma.report.upsert({
      where: { interviewId: interview.id },
      update: {
        overallScore: session.overallScore,
        technical: session.technical,
        communication: session.communication,
        clarity: session.clarity,
        confidence: session.confidence,
        depth: session.depth,
        pace: session.pace,
        strengths: session.strengths,
        weaknesses: session.weaknesses,
        suggestions: session.suggestions,
        generatedAt: new Date(),
      },
      create: {
        interviewId: interview.id,
        userId: interview.userId,
        overallScore: session.overallScore,
        technical: session.technical,
        communication: session.communication,
        clarity: session.clarity,
        confidence: session.confidence,
        depth: session.depth,
        pace: session.pace,
        strengths: session.strengths,
        weaknesses: session.weaknesses,
        suggestions: session.suggestions,
      },
    });

    // Trigger downstream: job matching
    await jobsService.matchForReport(report.id);

    return report;
  },

  async getReport(userId: string, interviewId: string) {
    const report = await prisma.report.findFirst({
      where: { interviewId, userId },
      include: {
        interview: { select: { role: true, category: true, difficulty: true, language: true, persona: true, createdAt: true } },
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
