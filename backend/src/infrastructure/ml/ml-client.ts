import axios from "axios";
import FormData from "form-data";
import fs from "node:fs";
import { env } from "@/shared/config/env";
import { logger } from "@/shared/logger/logger";

const http = axios.create({
  baseURL: env.ML_SERVICE_URL,
  timeout: 60_000,
});

export interface CvParsedResult {
  skills: string[];
  education: string[];
  experience: string[];
  certifications: string[];
  technologies: string[];
  yearsTotal?: number;
  readinessScore: number;
  suggestedTracks: string[];
  rawText: string;
}

export type PerformanceLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface AnswerScore {
  confidence: number;
  communication: number;
  relevance: number;
  technical: number;
  fluency: number;
  pace: number;
  notes?: string[];
}

export interface LearningResource {
  title: string;
  type: string;
  url?: string;
  description?: string;
}

export interface SessionScore {
  overallScore: number;
  confidence: number;
  communication: number;
  relevance: number;
  technical: number;
  fluency: number;
  pace: number;
  performanceLevel: PerformanceLevel;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  resources: LearningResource[];
}

export const mlClient = {
  async parseCv(filePath: string): Promise<CvParsedResult> {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));
    try {
      const res = await http.post("/cv/parse", form, {
        headers: form.getHeaders(),
      });
      return res.data as CvParsedResult;
    } catch (err: unknown) {
      logger.warn({ err }, "ML CV parse failed; returning heuristic fallback");
      return fallbackCv();
    }
  },

  async scoreAnswer(args: {
    question: string;
    transcript: string;
    language: string;
  }): Promise<AnswerScore> {
    try {
      const res = await http.post("/score/answer", args);
      return res.data as AnswerScore;
    } catch (err) {
      logger.warn({ err }, "ML score/answer failed; using heuristic");
      return heuristicAnswerScore(args.transcript);
    }
  },

  async scoreSession(args: {
    answers: { question: string; transcript: string; metrics?: AnswerScore }[];
    role: string;
    language: string;
  }): Promise<SessionScore> {
    try {
      const res = await http.post("/score/session", args);
      return res.data as SessionScore;
    } catch (err) {
      logger.warn({ err }, "ML score/session failed; aggregating heuristically");
      return aggregateHeuristic(args.answers);
    }
  },

  async transcribe(
    filePath: string,
    language?: string
  ): Promise<{ text: string; whisper?: WhisperMeta }> {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));
    if (language) form.append("language", language);
    try {
      const res = await http.post("/transcribe", form, {
        headers: form.getHeaders(),
      });
      return {
        text: (res.data.text as string) ?? "",
        whisper: res.data.whisper as WhisperMeta | undefined,
      };
    } catch (err) {
      logger.warn({ err }, "ML transcribe failed");
      return { text: "" };
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

// -------- fallbacks (keep API usable even if ML svc is down) --------

function fallbackCv(): CvParsedResult {
  return {
    skills: ["JavaScript", "TypeScript", "React", "Node.js"],
    education: [],
    experience: [],
    certifications: [],
    technologies: ["React", "Node.js"],
    readinessScore: 60,
    suggestedTracks: ["react", "swe"],
    rawText: "",
  };
}

function heuristicAnswerScore(transcript: string): AnswerScore {
  const wc = transcript.trim().split(/\s+/).filter(Boolean).length;
  const base = Math.min(95, 55 + Math.round(wc / 4));
  return {
    confidence: Math.max(50, base - 4),
    communication: Math.min(95, base + 3),
    relevance: Math.min(95, base + 1),
    technical: base,
    fluency: Math.min(95, base - 2),
    pace: 84,
  };
}

function pickLevel(score: number): PerformanceLevel {
  if (score >= 80) return "ADVANCED";
  if (score >= 60) return "INTERMEDIATE";
  return "BEGINNER";
}

function aggregateHeuristic(
  answers: { question: string; transcript: string; metrics?: AnswerScore }[]
): SessionScore {
  if (answers.length === 0) {
    return zeroSession();
  }
  const m = answers.map((a) => a.metrics ?? heuristicAnswerScore(a.transcript));
  const avg = (k: keyof AnswerScore) =>
    Math.round(m.reduce((s, x) => s + (x[k] as number), 0) / m.length);

  const confidence = avg("confidence");
  const communication = avg("communication");
  const relevance = avg("relevance");
  const technical = avg("technical");
  const fluency = avg("fluency");
  const pace = avg("pace");
  const overall = Math.round(
    (confidence + communication + relevance + technical + fluency + pace) / 6
  );

  return {
    overallScore: overall,
    confidence,
    communication,
    relevance,
    technical,
    fluency,
    pace,
    performanceLevel: pickLevel(overall),
    strengths: [
      "Structured answers with concrete examples",
      "Maintained an even pace throughout the session",
      "Stayed engaged across the full interview",
    ],
    weaknesses: [
      "Some answers lacked depth on edge cases",
      "Filler words appeared in the opening minutes",
    ],
    suggestions: [
      "Drill 2–3 system-design walkthroughs this week",
      "Record a 60-second self-intro and refine it daily",
      "Pause for 2 seconds before answering hard questions",
    ],
    resources: [
      {
        title: "Designing Data-Intensive Applications",
        type: "Book",
        description: "Foundations every senior interviewer probes.",
      },
      {
        title: "STAR method playbook",
        type: "Article",
        description: "Structure behavioral answers with concrete outcomes.",
      },
    ],
  };
}

function zeroSession(): SessionScore {
  return {
    overallScore: 0,
    confidence: 0,
    communication: 0,
    relevance: 0,
    technical: 0,
    fluency: 0,
    pace: 0,
    performanceLevel: "BEGINNER",
    strengths: [],
    weaknesses: ["No answers were recorded for this session."],
    suggestions: ["Try a fresh mock interview and respond to at least 3 questions."],
    resources: [],
  };
}
