import { Router } from "express";
import { asyncHandler } from "@/http/middlewares/async-handler";
import { requireAuth } from "@/http/middlewares/auth";
import { interviewService, interviewMeta } from "@/modules/interview/application/interview-service";
import { mlClient } from "@/infrastructure/ml/ml-client";
import {
  CreateInterviewDto,
  EndInterviewDto,
  SubmitAnswerDto,
} from "@/modules/interview/presentation/dto";

export const interviewRouter = Router();

// Public: list available tracks (used by the setup screen)
interviewRouter.get("/tracks", (_req, res) => {
  res.json({ tracks: interviewMeta.tracks });
});

interviewRouter.use(requireAuth);

interviewRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = CreateInterviewDto.parse(req.body);
    const interview = await interviewService.create(req.user!.sub, input);
    res.status(201).json({ interview });
  })
);

interviewRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await interviewService.list(req.user!.sub);
    res.json({ items });
  })
);

interviewRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const interview = await interviewService.get(req.user!.sub, req.params.id);
    res.json({ interview });
  })
);

interviewRouter.post(
  "/:id/start",
  asyncHandler(async (req, res) => {
    const interview = await interviewService.start(req.user!.sub, req.params.id);
    res.json({ interview });
  })
);

interviewRouter.post(
  "/:id/answers",
  asyncHandler(async (req, res) => {
    const input = SubmitAnswerDto.parse(req.body);
    const result = await interviewService.submitAnswer(req.user!.sub, req.params.id, input);
    res.status(201).json(result);
  })
);

interviewRouter.post(
  "/evaluate-code",
  asyncHandler(async (req, res) => {
    const { code, language, problem } = req.body;
    const result = await mlClient.evaluateCode({ code, language, problem });
    res.json(result);
  })
);

interviewRouter.post(
  "/:id/end",
  asyncHandler(async (req, res) => {
    const input = EndInterviewDto.parse(req.body ?? {});
    const interview = await interviewService.end(req.user!.sub, req.params.id, input);
    res.json({ interview });
  })
);
