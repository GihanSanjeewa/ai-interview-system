import "express-async-errors";
import express from "express";
import http from "node:http";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";

import { env } from "@/shared/config/env";
import { logger } from "@/shared/logger/logger";
import { prisma } from "@/infrastructure/prisma/client";

import { authRouter } from "@/http/routes/auth.routes";
import { cvRouter } from "@/http/routes/cv.routes";
import { interviewRouter } from "@/http/routes/interview.routes";
import { reportRouter } from "@/http/routes/report.routes";
import { jobRouter } from "@/http/routes/job.routes";
import { errorHandler, notFound } from "@/http/middlewares/error-handler";
import { attachInterviewGateway } from "@/ws/interview-gateway";

const app = express();
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(
  cors({
    origin: env.APP_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/healthz" } }));

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "test",
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "test",
});

// Health
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/readyz", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

// API v1
app.use("/api/v1/auth", authLimiter, authRouter);
app.use("/api/v1/cvs", apiLimiter, cvRouter);
app.use("/api/v1/interviews", apiLimiter, interviewRouter);
app.use("/api/v1/reports", apiLimiter, reportRouter);
app.use("/api/v1/jobs", apiLimiter, jobRouter);

// Back-compat with legacy frontend
app.use("/api/auth", authRouter);

app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
attachInterviewGateway(server);

server.listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
});

// Graceful shutdown
const shutdown = async () => {
  logger.info("Shutting down");
  await prisma.$disconnect();
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
