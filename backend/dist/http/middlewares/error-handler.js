"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
exports.notFound = notFound;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const app_error_1 = require("@/shared/errors/app-error");
const logger_1 = require("@/shared/logger/logger");
function errorHandler(err, _req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
_next) {
    if (err instanceof zod_1.ZodError) {
        return res.status(422).json({
            type: "about:blank",
            title: "Validation failed",
            status: 422,
            code: "validation_error",
            errors: err.flatten().fieldErrors,
        });
    }
    if (err instanceof app_error_1.AppError) {
        return res.status(err.status).json({
            type: "about:blank",
            title: err.message,
            status: err.status,
            code: err.code,
            detail: err.details,
        });
    }
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
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
    logger_1.logger.error({ err }, "Unhandled error");
    return res.status(500).json({
        type: "about:blank",
        title: "Internal server error",
        status: 500,
        code: "internal",
    });
}
function notFound(_req, res) {
    res.status(404).json({
        type: "about:blank",
        title: "Route not found",
        status: 404,
        code: "not_found",
    });
}
//# sourceMappingURL=error-handler.js.map