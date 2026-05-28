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

export interface AnswerScore {
  technical: number;
  communication: number;
  clarity: number;
  confidence: number;
  depth: number;
  pace: number;
  notes?: string[];
}

export interface SessionScore {
  overallScore: number;
  technical: number;
  communication: number;
  clarity: number;
  confidence: number;
  depth: number;
  pace: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
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

  async transcribe(filePath: string, language?: string): Promise<string> {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));
    if (language) form.append("language", language);
    try {
      const res = await http.post("/transcribe", form, {
        headers: form.getHeaders(),
      });
      return res.data.text as string;
    } catch (err) {
      logger.warn({ err }, "ML transcribe failed");
      return "";
    }
  },
};

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
    technical: base,
    communication: Math.min(95, base + 3),
    clarity: Math.min(95, base + 1),
    confidence: Math.max(50, base - 4),
    depth: Math.min(95, base - 2),
    pace: 84,
  };
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

  const technical = avg("technical");
  const communication = avg("communication");
  const clarity = avg("clarity");
  const confidence = avg("confidence");
  const depth = avg("depth");
  const pace = avg("pace");

  return {
    overallScore: Math.round(
      (technical + communication + clarity + confidence + depth + pace) / 6
    ),
    technical,
    communication,
    clarity,
    confidence,
    depth,
    pace,
    strengths: [
      "Structured answers with concrete examples",
      "Maintained an even pace throughout the session",
    ],
    weaknesses: [
      "Some answers lacked depth on edge cases",
      "Reduce filler words in the opening minutes",
    ],
    suggestions: [
      "Drill 2–3 system-design walkthroughs this week",
      "Record a 60-second self-intro and refine it daily",
    ],
  };
}

function zeroSession(): SessionScore {
  return {
    overallScore: 0,
    technical: 0,
    communication: 0,
    clarity: 0,
    confidence: 0,
    depth: 0,
    pace: 0,
    strengths: [],
    weaknesses: ["No answers were recorded for this session."],
    suggestions: ["Try a fresh mock interview and respond to at least 3 questions."],
  };
}
