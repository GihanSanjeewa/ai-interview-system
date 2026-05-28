"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
class AppError extends Error {
    status;
    code;
    details;
    constructor(status, code, message, details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.name = "AppError";
    }
    static badRequest(message = "Bad request", details) {
        return new AppError(400, "bad_request", message, details);
    }
    static unauthorized(message = "Unauthorized") {
        return new AppError(401, "unauthorized", message);
    }
    static forbidden(message = "Forbidden") {
        return new AppError(403, "forbidden", message);
    }
    static notFound(message = "Not found") {
        return new AppError(404, "not_found", message);
    }
    static conflict(message = "Conflict") {
        return new AppError(409, "conflict", message);
    }
    static internal(message = "Internal server error") {
        return new AppError(500, "internal", message);
    }
}
exports.AppError = AppError;
//# sourceMappingURL=app-error.js.map