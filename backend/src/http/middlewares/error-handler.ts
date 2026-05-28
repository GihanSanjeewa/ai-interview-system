import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "@/shared/errors/app-error";
import { logger } from "@/shared/logger/logger";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      type: "about:blank",
      title: "Validation failed",
      status: 422,
      code: "validation_error",
      errors: err.flatten().fieldErrors,
    });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({
      type: "about:blank",
      title: err.message,
      status: err.status,
      code: err.code,
      detail: err.details,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({
        type: "about:blank",
        title: "Resource already exists",
        status: 409,
        code: "conflict",
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({
        type: "about:blank",
        title: "Resource not found",
        status: 404,
        code: "not_found",
      });
    }
  }

  logger.error({ err }, "Unhandled error");
  return res.status(500).json({
    type: "about:blank",
    title: "Internal server error",
    status: 500,
    code: "internal",
  });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({
    type: "about:blank",
    title: "Route not found",
    status: 404,
    code: "not_found",
  });
}
