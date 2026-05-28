import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "@/shared/config/env";
import { logger } from "@/shared/logger/logger";
import { verifyAccessToken } from "@/modules/identity/domain/token";
import { prisma } from "@/infrastructure/prisma/client";
import { interviewService } from "@/modules/interview/application/interview-service";

export function attachInterviewGateway(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.APP_URL,
      credentials: true,
    },
    path: "/ws",
  });

  io.use((socket, next) => {
    const token = (socket.handshake.auth?.token ?? socket.handshake.query?.token) as
      | string
      | undefined;
    if (!token) return next(new Error("missing_token"));
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      return next();
    } catch {
      return next(new Error("invalid_token"));
    }
  });

  io.on("connection", (socket) => {
    const userId: string = socket.data.userId;
    logger.debug({ userId }, "ws connected");

    socket.on("interview:join", async ({ interviewId }: { interviewId: string }) => {
      try {
        const iv = await interviewService.get(userId, interviewId);
        socket.join(`interview:${iv.id}`);
        const nextQ =
          iv.questions.find((q) => !q.answer) ?? iv.questions[0];
        socket.emit("interview:joined", {
          interview: {
            id: iv.id,
            role: iv.role,
            category: iv.category,
            language: iv.language,
            difficulty: iv.difficulty,
            persona: iv.persona,
            status: iv.status,
            plannedSec: iv.plannedSec,
          },
          totalQuestions: iv.questions.length,
          nextQuestion: nextQ
            ? { id: nextQ.id, ordinal: nextQ.ordinal, text: nextQ.text, phase: nextQ.phase }
            : null,
        });
      } catch (err) {
        socket.emit("error", { message: (err as Error).message });
      }
    });

    socket.on("interview:start", async ({ interviewId }: { interviewId: string }) => {
      try {
        const iv = await interviewService.start(userId, interviewId);
        io.to(`interview:${iv.id}`).emit("interview:state", { status: iv.status });
        const firstQ = iv.questions.find((q) => !q.answer) ?? iv.questions[0];
        if (firstQ) {
          io.to(`interview:${iv.id}`).emit("ai:state", { state: "speaking" });
          io.to(`interview:${iv.id}`).emit("question", {
            id: firstQ.id,
            ordinal: firstQ.ordinal,
            text: firstQ.text,
            phase: firstQ.phase,
          });
          io.to(`interview:${iv.id}`).emit("ai:state", { state: "listening" });
        }
      } catch (err) {
        socket.emit("error", { message: (err as Error).message });
      }
    });

    socket.on(
      "answer:submit",
      async (payload: { interviewId: string; questionId: string; transcript: string; durationMs?: number }) => {
        try {
          const { answer, nextQuestion } = await interviewService.submitAnswer(
            userId,
            payload.interviewId,
            {
              questionId: payload.questionId,
              transcript: payload.transcript,
              durationMs: payload.durationMs,
            }
          );
          io.to(`interview:${payload.interviewId}`).emit("transcript:final", {
            who: "user",
            text: answer.transcript,
          });
          io.to(`interview:${payload.interviewId}`).emit("metric:update", answer.metrics);

          if (nextQuestion === null) {
            io.to(`interview:${payload.interviewId}`).emit("interview:ended", {
              interviewId: payload.interviewId,
              reportPending: true,
            });
            return;
          }
          const q = await prisma.question.findFirst({
            where: { interviewId: payload.interviewId, ordinal: nextQuestion },
          });
          if (q) {
            io.to(`interview:${payload.interviewId}`).emit("ai:state", { state: "thinking" });
            setTimeout(() => {
              io.to(`interview:${payload.interviewId}`).emit("ai:state", { state: "speaking" });
              io.to(`interview:${payload.interviewId}`).emit("question", {
                id: q.id,
                ordinal: q.ordinal,
                text: q.text,
                phase: q.phase,
              });
              io.to(`interview:${payload.interviewId}`).emit("ai:state", { state: "listening" });
            }, 600);
          }
        } catch (err) {
          socket.emit("error", { message: (err as Error).message });
        }
      }
    );

    socket.on("interview:end", async ({ interviewId, abortReason }: { interviewId: string; abortReason?: string }) => {
      try {
        await interviewService.end(userId, interviewId, { abortReason });
        io.to(`interview:${interviewId}`).emit("interview:ended", {
          interviewId,
          reportPending: true,
        });
      } catch (err) {
        socket.emit("error", { message: (err as Error).message });
      }
    });

    socket.on("disconnect", () => {
      logger.debug({ userId }, "ws disconnected");
    });
  });

  return io;
}
