"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportRouter = void 0;
const express_1 = require("express");
const async_handler_1 = require("@/http/middlewares/async-handler");
const auth_1 = require("@/http/middlewares/auth");
const scoring_service_1 = require("@/modules/scoring/application/scoring-service");
exports.reportRouter = (0, express_1.Router)();
exports.reportRouter.use(auth_1.requireAuth);
exports.reportRouter.get("/", (0, async_handler_1.asyncHandler)(async (req, res) => {
    const items = await scoring_service_1.scoringService.listForUser(req.user.sub);
    res.json({ items });
}));
exports.reportRouter.get("/:interviewId", (0, async_handler_1.asyncHandler)(async (req, res) => {
    const report = await scoring_service_1.scoringService.getReport(req.user.sub, req.params.interviewId);
    res.json({ report });
}));
exports.reportRouter.post("/:interviewId/regenerate", (0, async_handler_1.asyncHandler)(async (req, res) => {
    const report = await scoring_service_1.scoringService.generateReport(req.params.interviewId);
    res.json({ report });
}));
//# sourceMappingURL=report.routes.js.map