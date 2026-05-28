"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobRouter = void 0;
const express_1 = require("express");
const async_handler_1 = require("@/http/middlewares/async-handler");
const auth_1 = require("@/http/middlewares/auth");
const jobs_service_1 = require("@/modules/jobs/application/jobs-service");
exports.jobRouter = (0, express_1.Router)();
exports.jobRouter.use(auth_1.requireAuth);
exports.jobRouter.get("/recommendations", (0, async_handler_1.asyncHandler)(async (req, res) => {
    const data = await jobs_service_1.jobsService.listRecommendations(req.user.sub);
    res.json(data);
}));
exports.jobRouter.get("/:id", (0, async_handler_1.asyncHandler)(async (req, res) => {
    const job = await jobs_service_1.jobsService.getJob(req.params.id);
    res.json({ job });
}));
//# sourceMappingURL=job.routes.js.map