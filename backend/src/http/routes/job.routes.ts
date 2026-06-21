import { Router } from "express";
import { asyncHandler } from "@/http/middlewares/async-handler";
import { requireAuth } from "@/http/middlewares/auth";
import { jobsService } from "@/modules/jobs/application/jobs-service";

export const jobRouter = Router();
jobRouter.use(requireAuth);

jobRouter.get(
  "/recommendations",
  asyncHandler(async (req, res) => {
    const data = await jobsService.listRecommendations(req.user!.sub);
    res.json(data);
  })
);

jobRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const job = await jobsService.getJob(req.params.id);
    res.json({ job });
  })
);
