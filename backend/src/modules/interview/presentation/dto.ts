import { z } from "zod";

export const CreateInterviewDto = z.object({
  role: z.string().min(2).max(255),
  category: z.string().min(1).max(64),
  language: z.enum(["en", "si"]).default("en"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
  persona: z.enum(["aria", "marcus", "kenji"]).default("aria"),
  plannedSec: z.number().int().min(300).max(7200).default(1800),
  cvId: z.string().uuid().optional(),
});
export type CreateInterviewInput = z.infer<typeof CreateInterviewDto>;

/**
 * Acoustic metrics returned by POST /audio/transcribe.
 *
 * Passing these back with the answer is what makes confidence, fluency and pace
 * real measurements. Without them those three metrics were constants (78/80/135)
 * in every report.
 */
export const AudioMetricsDto = z.object({
  words_per_minute: z.number().nonnegative(),
  confidence_score: z.number().min(0).max(100),
  fluency_score: z.number().min(0).max(100),
  speaking_speed_score: z.number().min(0).max(100),
  word_count: z.number().int().nonnegative(),
  filler_count: z.number().int().nonnegative(),
});

export const SubmitAnswerDto = z.object({
  questionId: z.string().uuid(),
  // An empty transcript is a real outcome (the candidate said nothing), and the
  // interviewer needs to respond to it rather than the request being rejected.
  transcript: z.string().max(20_000),
  durationMs: z.number().int().nonnegative().optional(),
  audio: AudioMetricsDto.partial().optional(),
});
export type SubmitAnswerInput = z.infer<typeof SubmitAnswerDto>;

export const EndInterviewDto = z.object({
  abortReason: z.string().max(255).optional(),
});
export type EndInterviewInput = z.infer<typeof EndInterviewDto>;
