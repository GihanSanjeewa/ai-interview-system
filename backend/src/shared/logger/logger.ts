import pino from "pino";
import { env } from "@/shared/config/env";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "api" },
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname,service",
          },
        }
      : undefined,
});

export type Logger = typeof logger;
