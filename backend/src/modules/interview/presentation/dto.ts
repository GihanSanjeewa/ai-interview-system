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

export const SubmitAnswerDto = z.object({
  questionId: z.string().uuid(),
  transcript: z.string().min(1).max(20_000),
  durationMs: z.number().int().nonnegative().optional(),
});
export type SubmitAnswerInput = z.infer<typeof SubmitAnswerDto>;

export const EndInterviewDto = z.object({
  abortReason: z.string().max(255).optional(),
});
export type EndInterviewInput = z.infer<typeof EndInterviewDto>;
