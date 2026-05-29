"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interviewRouter = void 0;
const express_1 = require("express");
const async_handler_1 = require("@/http/middlewares/async-handler");
const auth_1 = require("@/http/middlewares/auth");
const interview_service_1 = require("@/modules/interview/application/interview-service");
const dto_1 = require("@/modules/interview/presentation/dto");
exports.interviewRouter = (0, express_1.Router)();
// Public: list available tracks (used by the setup screen)
exports.interviewRouter.get("/tracks", (_req, res) => {
    res.json({ tracks: interview_service_1.interviewMeta.tracks });
});
exports.interviewRouter.use(auth_1.requireAuth);
exports.interviewRouter.post("/", (0, async_handler_1.asyncHandler)(async (req, res) => {
    const input = dto_1.CreateInterviewDto.parse(req.body);
    const interview = await interview_service_1.interviewService.create(req.user.sub, input);
    res.status(201).json({ interview });
}));
exports.interviewRouter.get("/", (0, async_handler_1.asyncHandler)(async (req, res) => {
    const items = await interview_service_1.interviewService.list(req.user.sub);
    res.json({ items });
}));
exports.interviewRouter.get("/:id", (0, async_handler_1.asyncHandler)(async (req, res) => {
    const interview = await interview_service_1.interviewService.get(req.user.sub, req.params.id);
    res.json({ interview });
}));
exports.interviewRouter.post("/:id/start", (0, async_handler_1.asyncHandler)(async (req, res) => {
    const interview = await interview_service_1.interviewService.start(req.user.sub, req.params.id);
    res.json({ interview });
}));
exports.interviewRouter.post("/:id/answers", (0, async_handler_1.asyncHandler)(async (req, res) => {
    const input = dto_1.SubmitAnswerDto.parse(req.body);
    const result = await interview_service_1.interviewService.submitAnswer(req.user.sub, req.params.id, input);
    res.status(201).json(result);
}));
exports.interviewRouter.post("/:id/end", (0, async_handler_1.asyncHandler)(async (req, res) => {
    const input = dto_1.EndInterviewDto.parse(req.body ?? {});
    const interview = await interview_service_1.interviewService.end(req.user.sub, req.params.id, input);
    res.json({ interview });
}));
//# sourceMappingURL=interview.routes.js.map