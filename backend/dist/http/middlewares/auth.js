"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
const token_1 = require("@/modules/identity/domain/token");
const app_error_1 = require("@/shared/errors/app-error");
function requireAuth(req, _res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return next(app_error_1.AppError.unauthorized("Missing access token"));
    }
    const token = header.slice("Bearer ".length).trim();
    try {
        req.user = (0, token_1.verifyAccessToken)(token);
        return next();
    }
    catch {
        return next(app_error_1.AppError.unauthorized("Invalid or expired access token"));
    }
}
function requireRole(...roles) {
    return (req, _res, next) => {
        if (!req.user)
            return next(app_error_1.AppError.unauthorized());
        if (!roles.includes(req.user.role))
            return next(app_error_1.AppError.forbidden());
        return next();
    };
}
//# sourceMappingURL=auth.js.map