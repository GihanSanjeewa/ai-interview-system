"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("express-async-errors");
const express_1 = __importDefault(require("express"));
const node_http_1 = __importDefault(require("node:http"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const pino_http_1 = __importDefault(require("pino-http"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("@/shared/config/env");
const logger_1 = require("@/shared/logger/logger");
const client_1 = require("@/infrastructure/prisma/client");
const auth_routes_1 = require("@/http/routes/auth.routes");
const cv_routes_1 = require("@/http/routes/cv.routes");
const interview_routes_1 = require("@/http/routes/interview.routes");
const report_routes_1 = require("@/http/routes/report.routes");
const job_routes_1 = require("@/http/routes/job.routes");
const audio_routes_1 = require("@/http/routes/audio.routes");
const error_handler_1 = require("@/http/middlewares/error-handler");
const interview_gateway_1 = require("@/ws/interview-gateway");
const app = (0, express_1.default)();
app.set("trust proxy", 1);
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use((0, cors_1.default)({
    origin: env_1.env.APP_URL,
    credentials: true,
}));
app.use(express_1.default.json({ limit: "1mb" }));
app.use((0, cookie_parser_1.default)());
app.use((0, pino_http_1.default)({ logger: logger_1.logger, autoLogging: { ignore: (req) => req.url === "/healthz" } }));
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => env_1.env.NODE_ENV === "test",
});
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => env_1.env.NODE_ENV === "test",
});
// Health
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/readyz", async (_req, res) => {
    try {
        await client_1.prisma.$queryRaw `SELECT 1`;
        res.json({ ok: true });
    }
    catch {
        res.status(503).json({ ok: false });
    }
});
// API v1
app.use("/api/v1/auth", authLimiter, auth_routes_1.authRouter);
app.use("/api/v1/cvs", apiLimiter, cv_routes_1.cvRouter);
app.use("/api/v1/interviews", apiLimiter, interview_routes_1.interviewRouter);
app.use("/api/v1/reports", apiLimiter, report_routes_1.reportRouter);
app.use("/api/v1/jobs", apiLimiter, job_routes_1.jobRouter);
app.use("/api/v1/audio", apiLimiter, audio_routes_1.audioRouter);
// Back-compat with legacy frontend
app.use("/api/auth", auth_routes_1.authRouter);
app.use(error_handler_1.notFound);
app.use(error_handler_1.errorHandler);
const server = node_http_1.default.createServer(app);
(0, interview_gateway_1.attachInterviewGateway)(server);
server.listen(env_1.env.PORT, () => {
    logger_1.logger.info(`API listening on http://localhost:${env_1.env.PORT}`);
});
// Graceful shutdown
const shutdown = async () => {
    logger_1.logger.info("Shutting down");
    await client_1.prisma.$disconnect();
    server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
//# sourceMappingURL=main.js.map