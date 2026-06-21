"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EndInterviewDto = exports.SubmitAnswerDto = exports.CreateInterviewDto = void 0;
const zod_1 = require("zod");
exports.CreateInterviewDto = zod_1.z.object({
    role: zod_1.z.string().min(2).max(255),
    category: zod_1.z.string().min(1).max(64),
    language: zod_1.z.enum(["en", "si"]).default("en"),
    difficulty: zod_1.z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
    persona: zod_1.z.enum(["aria", "marcus", "kenji"]).default("aria"),
    plannedSec: zod_1.z.number().int().min(300).max(7200).default(1800),
    cvId: zod_1.z.string().uuid().optional(),
});
exports.SubmitAnswerDto = zod_1.z.object({
    questionId: zod_1.z.string().uuid(),
    transcript: zod_1.z.string().min(1).max(20_000),
    durationMs: zod_1.z.number().int().nonnegative().optional(),
});
exports.EndInterviewDto = zod_1.z.object({
    abortReason: zod_1.z.string().max(255).optional(),
});
//# sourceMappingURL=dto.js.map