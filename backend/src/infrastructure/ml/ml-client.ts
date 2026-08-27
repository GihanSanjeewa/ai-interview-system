import axios from "axios";
import FormData from "form-data";
import fs from "node:fs";
import { env } from "@/shared/config/env";
import { logger } from "@/shared/logger/logger";

const http = axios.create({
  baseURL: env.ML_SERVICE_URL,
  timeout: 60_000,
});

/**
 * Thrown when the ML service cannot answer. The previous implementation
 * swallowed every failure and substituted invented data — a fabricated CV with
 * "JavaScript, TypeScript, React, Node.js", fixed answer scores, and a canned
 * report — so an outage looked identical to a successful analysis. Failures now
 * surface so the caller can mark the record FAILED and tell the user.
 */
export class MlServiceError extends Error {
  constructor(
    readonly operation: string,
    readonly cause: unknown,
  ) {
    super(`ML service ${operation} failed: ${describe(cause)}`);
    this.name = "MlServiceError";
  }
}

function describe(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.code === "ECONNREFUSED") return "service unreachable";
    const detail = (err.response?.data as { detail?: string } | undefined)?.detail;
    return detail ?? err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

// ─────────────────────────────────────────────────────────────────────────────
// CV analysis
// ─────────────────────────────────────────────────────────────────────────────

export interface CvContact {
  name: string | null;
  email: string | null;
  phone: string | null;
  links: string[];
}

export interface CvEducationEntry {
  label: string;
  degree: string | null;
  field: string | null;
  institution: string | null;
  graduationYear: number | null;
}

export interface CvExperienceEntry {
  label: string;
  title: string | null;
  organisation: string | null;
  months: number | null;
  current: boolean;
}

export interface CvTrackAnalysis {
  track: string;
  label: string;
  matched: string[];
  matchCount: number;
  confidence: number;
}

export interface CvParsedResult {
  contact: CvContact;
  skills: string[];
  technologies: string[];
  demonstratedTechnologies: string[];
  education: string[];
  educationDetail: CvEducationEntry[];
  experience: string[];
  experienceDetail: CvExperienceEntry[];
  certifications: string[];
  projects: string[];
  /** null when the CV states no dates — never guessed. */
  yearsTotal: number | null;
  seniority: string;
  readinessScore: number;
  readinessBreakdown: Record<string, number>;
  suggestedTracks: string[];
  trackAnalysis: CvTrackAnalysis[];
  sectionsFound: string[];
  extractionConfidence: number;
  warnings: string[];
  rawText: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Interview planning & turn-taking
// ─────────────────────────────────────────────────────────────────────────────

/** The candidate profile the planner reads. Mirrors the CV analyser output. */
export interface InterviewProfile {
  technologies?: string[];
  skills?: string[];
  demonstratedTechnologies?: string[];
  education?: string[];
  experience?: string[];
  certifications?: string[];
  projects?: string[];
  yearsTotal?: number | null;
  role?: string;
}

export interface PlannedQuestion {
  ordinal: number;
  text: string;
  phase: string;
  domain: string;
  difficulty: string;
  source: string;
  expects: string[];
}

export interface InterviewPlan {
  track: string;
  trackLabel: string;
  difficultyEntry: string;
  poolSize: number;
  cvGrounded: number;
  questions: PlannedQuestion[];
}

export type TurnAction = "next" | "followup" | "repeat" | "easier" | "end";

export type TurnIntent =
  | "substantive"
  | "thin"
  | "dont_know"
  | "clarify"
  | "silent";

export interface TurnDecision {
  /** What the interview should do next. */
  action: TurnAction;
  /** What the interviewer says out loud before the next question. */
  say: string;
  intent: TurnIntent;
  intentConfidence: number;
  intentReason: string;
  /** True when the answer must not count against technical accuracy. */
  skipped: boolean;
  /** A newly generated question, for `followup` and `easier`. */
  followup: PlannedQuestion | null;
  note: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────────────────────────────────────

export type PerformanceLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

/** Acoustic metrics measured by librosa at transcription time. */
export interface AudioMetrics {
  words_per_minute: number;
  confidence_score: number;
  fluency_score: number;
  speaking_speed_score: number;
  word_count: number;
  filler_count: number;
}

export interface AnswerScore {
  confidence: number;
  communication: number;
  relevance: number;
  technical: number;
  fluency: number;
  pace: number;
  intent: TurnIntent;
  skipped: boolean;
  /** False when confidence/fluency are text estimates rather than measured. */
  audioMeasured: boolean;
  notes?: string[];
}

export interface LearningResource {
  title: string;
  type: string;
  url?: string;
  description?: string;
}

export interface SessionAnalytics {
  answerCount: number;
  answeredCount: number;
  skippedCount: number;
  coverage: number;
  avgWords?: number;
  totalWords?: number;
  avgFillerRate?: number;
  concreteExamples?: number;
  structuredAnswers?: number;
  hedgeTotal?: number;
  trends?: Record<string, number | null>;
  byDomain?: { domain: string; questions: number; technical: number | null }[];
  byDifficulty?: { difficulty: string; questions: number; technical: number | null }[];
  skippedQuestions?: { ordinal: number; question: string; domain: string; difficulty: string }[];
}

export interface SessionScore {
  overallScore: number;
  confidence: number;
  communication: number;
  relevance: number;
  technical: number;
  fluency: number;
  pace: number;
  paceScore: number;
  paceWpm: number | null;
  performanceLevel: PerformanceLevel;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  resources: LearningResource[];
  diagnosis: string[];
  analytics: SessionAnalytics;
  perQuestion: Record<string, unknown>[];
}

export interface WhisperMeta {
  model: string;
  backend: string;
  finetuned: boolean;
  latency_ms: number | null;
  duration_sec: number | null;
}

export interface WhisperInfo {
  en: { model: string; backend: string; label: string; finetuned: boolean };
  si: { model: string; backend: string; label: string; finetuned: boolean };
}

// ─────────────────────────────────────────────────────────────────────────────

export const mlClient = {
  /** Parse and analyse a CV. Throws MlServiceError rather than inventing data. */
  async parseCv(filePath: string): Promise<CvParsedResult> {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));
    try {
      const res = await http.post("/cv/parse", form, {
        headers: form.getHeaders(),
      });
      return normaliseCv(res.data ?? {});
    } catch (err) {
      logger.error({ err, filePath }, "ML CV parse failed");
      throw new MlServiceError("CV parse", err);
    }
  },

  /** Build a CV-grounded, adaptive interview plan. */
  async planInterview(args: {
    profile: InterviewProfile;
    role: string;
    track: string;
    difficulty: string;
    total: number;
  }): Promise<InterviewPlan> {
    try {
      const res = await http.post("/interview/plan", args);
      const plan = res.data as InterviewPlan;
      if (!plan?.questions?.length) {
        throw new Error("planner returned no questions");
      }
      return plan;
    } catch (err) {
      logger.error({ err, role: args.role }, "ML interview plan failed");
      throw new MlServiceError("interview plan", err);
    }
  },

  /**
   * Decide the interviewer's next move for one turn.
   *
   * On failure this advances the interview rather than throwing — a live
   * interview must never stall on a scoring outage.
   */
  async nextTurn(args: {
    question: PlannedQuestion | { text: string; [k: string]: unknown };
    answer: string;
    answerScore?: AnswerScore;
    history?: { intent?: string; question?: string }[];
    profile?: InterviewProfile;
    track?: string;
    difficulty?: string;
    followupsUsed?: number;
    remaining?: number;
  }): Promise<TurnDecision> {
    try {
      const res = await http.post("/interview/turn", args);
      return res.data as TurnDecision;
    } catch (err) {
      logger.warn({ err }, "ML interview turn failed; advancing the plan");
      return {
        action: "next",
        say: "Thank you. Let's move on to the next question.",
        intent: "substantive",
        intentConfidence: 0,
        intentReason: "ml_unavailable",
        skipped: false,
        followup: null,
        note: "fallback: turn decision unavailable",
      };
    }
  },

  /** Score one answer. Pass `audio` from transcribe() for measured delivery. */
  async scoreAnswer(args: {
    question: PlannedQuestion | { text: string; [k: string]: unknown } | string;
    transcript: string;
    language: string;
    audio?: AudioMetrics | null;
    domain?: string;
  }): Promise<AnswerScore> {
    try {
      const res = await http.post("/score/answer", args);
      return res.data as AnswerScore;
    } catch (err) {
      logger.error({ err }, "ML score/answer failed");
      throw new MlServiceError("answer scoring", err);
    }
  },

  /** Generate the full report from the session's real answers. */
  async scoreSession(args: {
    answers: {
      question: PlannedQuestion | { text: string; [k: string]: unknown };
      transcript: string;
      metrics?: AnswerScore | null;
      durationMs?: number | null;
      intent?: string | null;
      audio?: AudioMetrics | null;
    }[];
    role: string;
    track?: string;
    language: string;
  }): Promise<SessionScore> {
    try {
      const res = await http.post("/score/session", args);
      return res.data as SessionScore;
    } catch (err) {
      logger.error({ err, role: args.role }, "ML score/session failed");
      throw new MlServiceError("session scoring", err);
    }
  },

  /**
   * Transcribe an audio answer.
   *
   * Returns the acoustic metrics alongside the text so the caller can pass
   * them into scoreAnswer — previously these were computed and discarded, which
   * is why confidence and fluency were constants in every report.
   */
  async transcribe(
    filePath: string,
    language?: string,
  ): Promise<{ text: string; audio: AudioMetrics | null; whisper?: WhisperMeta }> {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));
    if (language) form.append("language", language);
    try {
      const res = await http.post("/transcribe", form, {
        headers: form.getHeaders(),
      });
      return {
        text: (res.data?.text as string) ?? "",
        audio: (res.data?.metrics as AudioMetrics) ?? null,
        whisper: res.data?.whisper as WhisperMeta | undefined,
      };
    } catch (err) {
      logger.error({ err }, "ML transcribe failed");
      throw new MlServiceError("transcription", err);
    }
  },

  async evaluateCode(args: {
    code: string;
    language: string;
    problem?: string;
  }): Promise<{
    score: number;
    correctness: number;
    quality: number;
    security: number;
    complexity: string;
    feedback: string[];
  }> {
    try {
      const res = await http.post("/evaluate_code", args);
      return res.data;
    } catch (err) {
      logger.error({ err }, "ML evaluate_code failed");
      throw new MlServiceError("code evaluation", err);
    }
  },

  async whisperInfo(): Promise<WhisperInfo | null> {
    try {
      const res = await http.get("/whisper/info");
      return res.data as WhisperInfo;
    } catch (err) {
      logger.debug({ err }, "ML /whisper/info unavailable");
      return null;
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Response normalisation
// ─────────────────────────────────────────────────────────────────────────────

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function normaliseCv(data: Record<string, any>): CvParsedResult {
  const extracted = data.extracted_info ?? {};
  const pick = (key: string) =>
    strArray(data[key]).length ? strArray(data[key]) : strArray(extracted[key]);

  // yearsTotal is deliberately preserved as null when absent: the analyser
  // returns null for a CV with no dated roles, and substituting a default here
  // would reintroduce the invented "2 years" the old client reported.
  const years =
    typeof data.yearsTotal === "number" && Number.isFinite(data.yearsTotal)
      ? data.yearsTotal
      : null;

  return {
    contact: {
      name: data.contact?.name ?? null,
      email: data.contact?.email ?? null,
      phone: data.contact?.phone ?? null,
      links: strArray(data.contact?.links),
    },
    skills: pick("skills"),
    technologies: pick("technologies"),
    demonstratedTechnologies: strArray(data.demonstratedTechnologies),
    education: pick("education"),
    educationDetail: Array.isArray(data.educationDetail) ? data.educationDetail : [],
    experience: pick("experience"),
    experienceDetail: Array.isArray(data.experienceDetail) ? data.experienceDetail : [],
    certifications: pick("certifications"),
    projects: pick("projects"),
    yearsTotal: years,
    seniority: typeof data.seniority === "string" ? data.seniority : "unknown",
    readinessScore:
      typeof data.readinessScore === "number" ? Math.round(data.readinessScore) : 0,
    readinessBreakdown:
      typeof data.readinessBreakdown === "object" && data.readinessBreakdown
        ? data.readinessBreakdown
        : {},
    suggestedTracks: strArray(data.suggestedTracks).length
      ? strArray(data.suggestedTracks)
      : strArray(data.domains),
    trackAnalysis: Array.isArray(data.trackAnalysis) ? data.trackAnalysis : [],
    sectionsFound: strArray(data.sectionsFound),
    extractionConfidence:
      typeof data.extractionConfidence === "number" ? data.extractionConfidence : 0,
    warnings: strArray(data.warnings),
    rawText: typeof data.rawText === "string" ? data.rawText : (data.text ?? ""),
  };
}
