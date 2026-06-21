import { Router } from "express";
import { asyncHandler } from "@/http/middlewares/async-handler";
import { requireAuth } from "@/http/middlewares/auth";
import { scoringService } from "@/modules/scoring/application/scoring-service";

export const reportRouter = Router();
reportRouter.use(requireAuth);

reportRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await scoringService.listForUser(req.user!.sub);
    res.json({ items });
  })
);

reportRouter.get(
  "/:interviewId",
  asyncHandler(async (req, res) => {
    const report = await scoringService.getReport(req.user!.sub, req.params.interviewId);
    res.json({ report });
  })
);

reportRouter.post(
  "/:interviewId/regenerate",
  asyncHandler(async (req, res) => {
    const report = await scoringService.generateReport(req.params.interviewId);
    res.json({ report });
  })
);
