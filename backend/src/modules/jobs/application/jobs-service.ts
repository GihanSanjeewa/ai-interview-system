import { prisma } from "@/infrastructure/prisma/client";
import { AppError } from "@/shared/errors/app-error";

interface SkillSet {
  skills: string[];
}

function jaccard(a: string[], b: string[]) {
  const A = new Set(a.map((s) => s.toLowerCase()));
  const B = new Set(b.map((s) => s.toLowerCase()));
  if (A.size === 0 && B.size === 0) return 0;
  let intersect = 0;
  A.forEach((x) => {
    if (B.has(x)) intersect++;
  });
  const union = A.size + B.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

function gaps(candidate: string[], required: string[]) {
  const cs = new Set(candidate.map((s) => s.toLowerCase()));
  return required.filter((s) => !cs.has(s.toLowerCase()));
}

export const jobsService = {
  async matchForReport(reportId: string) {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: { interview: { include: { cv: true } } },
    });
    if (!report) return;

    const cv = report.interview.cv;
    const parsed = (cv?.parsed as SkillSet | undefined) ?? { skills: [] };
    const candidateSkills = parsed.skills ?? [];

    const jobs = await prisma.job.findMany({ take: 50 });
    const scored = jobs
      .map((job) => {
        const jobSkills = ((job.skills as unknown) as string[] | undefined) ?? [];
        const sim = jaccard(candidateSkills, jobSkills);
        const seniorityFit = bandFit(report.overallScore, job.seniority);
        const matchScore = Math.round((sim * 0.7 + seniorityFit * 0.3) * 100);
        const missing = gaps(candidateSkills, jobSkills);
        return {
          jobId: job.id,
          matchScore,
          reasonJson: {
            similarity: sim,
            seniorityFit,
            matchingSkills: jobSkills.filter((s) =>
              candidateSkills.map((c) => c.toLowerCase()).includes(s.toLowerCase())
            ),
          },
          skillGaps: missing,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);

    await prisma.$transaction([
      prisma.jobMatch.deleteMany({ where: { reportId } }),
      ...scored.map((s) =>
        prisma.jobMatch.create({
          data: {
            reportId,
            jobId: s.jobId,
            matchScore: s.matchScore,
            reasonJson: s.reasonJson,
            skillGaps: s.skillGaps,
          },
        })
      ),
    ]);
  },

  async listRecommendations(userId: string, limit = 10) {
    const latest = await prisma.report.findFirst({
      where: { userId },
      orderBy: { generatedAt: "desc" },
      include: {
        jobMatches: {
          include: { job: true },
          orderBy: { matchScore: "desc" },
          take: limit,
        },
      },
    });
    if (!latest) return { items: [] };
    return {
      items: latest.jobMatches.map((m) => ({
        match: {
          score: m.matchScore,
          matchingSkills:
            (m.reasonJson as { matchingSkills?: string[] } | null)?.matchingSkills ?? [],
          skillGaps: m.skillGaps as string[],
        },
        job: m.job,
      })),
    };
  },

  async getJob(id: string) {
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) throw AppError.notFound("Job not found");
    return job;
  },
};

function bandFit(overall: number, seniority: string | null) {
  if (!seniority) return 0.6;
  const s = seniority.toLowerCase();
  if (s.includes("junior")) return overall < 65 ? 1 : 0.6;
  if (s.includes("senior") || s.includes("lead")) return overall >= 80 ? 1 : 0.4;
  return overall >= 65 && overall < 85 ? 1 : 0.55;
}
