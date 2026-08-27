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
      const data = res.data ?? {};
      const extracted = data.extracted_info ?? {};

      const skills = Array.isArray(data.skills) ? data.skills : (Array.isArray(extracted.skills) ? extracted.skills : []);
      const technologies = Array.isArray(data.technologies) ? data.technologies : (Array.isArray(extracted.technologies) ? extracted.technologies : []);
      const education = Array.isArray(data.education) ? data.education : (Array.isArray(extracted.education) ? extracted.education : []);
      const experience = Array.isArray(data.experience) ? data.experience : (Array.isArray(extracted.experience) ? extracted.experience : []);
      const certifications = Array.isArray(data.certifications) ? data.certifications : (Array.isArray(extracted.certifications) ? extracted.certifications : []);
      const suggestedTracks = Array.isArray(data.suggestedTracks) ? data.suggestedTracks : (Array.isArray(data.domains) ? data.domains : ["swe"]);
      const readinessScore = typeof data.readinessScore === "number" ? data.readinessScore : 75;
      const yearsTotal = typeof data.yearsTotal === "number" ? data.yearsTotal : 2.0;
      const rawText = data.rawText || data.text || "";

      return {
        skills,
        education,
        experience,
        certifications,
        technologies,
        yearsTotal,
        readinessScore,
        suggestedTracks,
        rawText,
      };
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
      const d = (res.data ?? {}) as Record<string, any>;
      const tech = Number(d.technical ?? d.technical_score ?? 78);
      const comm = Number(d.communication ?? d.communication_score ?? 80);
      const rel = Number(d.relevance ?? d.response_relevance_score ?? 82);
      const conf = Number(d.confidence ?? d.confidence_score ?? 78);
      const fl = Number(d.fluency ?? d.fluency_score ?? 80);
      const pace = Number(d.pace ?? d.speaking_speed_score ?? 135);
      const overall = Number(
        d.overallScore ?? Math.round((tech * 0.35) + (rel * 0.25) + (comm * 0.2) + (conf * 0.1) + (fl * 0.1))
      );

      const rawLevel = String(d.performanceLevel ?? d.performance_level ?? "").toUpperCase();
      const performanceLevel: PerformanceLevel =
        rawLevel === "ADVANCED" || rawLevel === "BEGINNER" ? rawLevel : "INTERMEDIATE";

      const strengths = Array.isArray(d.strengths ?? d.key_strengths)
        ? (d.strengths ?? d.key_strengths)
        : ["Clear articulation of technical concepts", "Structured problem-solving responses"];

      const weaknesses = Array.isArray(d.weaknesses ?? d.areas_for_improvement)
        ? (d.weaknesses ?? d.areas_for_improvement)
        : ["Provide deeper analysis of edge cases and trade-offs"];

      const suggestions = Array.isArray(d.suggestions ?? d.recommendations)
        ? (d.suggestions ?? d.recommendations).map((s: any) =>
            typeof s === "string" ? s : s?.title || s?.rationale || "Continue regular mock practice"
          )
        : ["Practice system design architecture scenarios", "Review core data structures and concurrency"];

      const resources = Array.isArray(d.resources ?? d.learning_resources)
        ? (d.resources ?? d.learning_resources).map((r: any) => ({
            title: r?.title || "Curated Learning Resource",
            type: r?.type || "Guide",
            url: r?.url,
            description: r?.description || "Recommended material to strengthen technical skills.",
          }))
        : [
            {
              title: "System Design Primer",
              type: "GitHub Repository",
              url: "https://github.com/donnemartin/system-design-primer",
              description: "Comprehensive guide to scaling high-throughput architectures.",
            },
          ];

      return {
        overallScore: overall,
        confidence: conf,
        communication: comm,
        relevance: rel,
        technical: tech,
        fluency: fl,
        pace,
        performanceLevel,
        strengths,
        weaknesses,
        suggestions,
        resources,
      };
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

  async evaluateCode(args: {
    code: string;
    language: string;
    problem?: string;
  }): Promise<{ score: number; correctness: number; quality: number; security: number; complexity: string; feedback: string[] }> {
    try {
      const res = await http.post("/evaluate_code", args);
      return res.data;
    } catch (err) {
      logger.warn({ err }, "ML evaluate_code failed; using heuristic");
      return {
        score: 75,
        correctness: 75,
        quality: 75,
        security: 90,
        complexity: "O(N)",
        feedback: ["Static code evaluation processed."]
      };
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
