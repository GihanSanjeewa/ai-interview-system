"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const async_handler_1 = require("@/http/middlewares/async-handler");
const auth_1 = require("@/http/middlewares/auth");
const identity_service_1 = require("@/modules/identity/application/identity-service");
const dto_1 = require("@/modules/identity/presentation/dto");
const env_1 = require("@/shared/config/env");
const REFRESH_COOKIE = "iv_rt";
function meta(req) {
    return {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
    };
}
function setRefreshCookie(res, session) {
    res.cookie(REFRESH_COOKIE, session.refreshToken, {
        httpOnly: true,
        sameSite: "strict",
        secure: env_1.env.COOKIE_SECURE,
        domain: env_1.env.COOKIE_DOMAIN,
        path: "/api/v1/auth",
        expires: session.refreshExpiresAt,
    });
}
function clearRefreshCookie(res) {
    res.clearCookie(REFRESH_COOKIE, {
        httpOnly: true,
        sameSite: "strict",
        secure: env_1.env.COOKIE_SECURE,
        domain: env_1.env.COOKIE_DOMAIN,
        path: "/api/v1/auth",
    });
}
function sendSession(res, session) {
    setRefreshCookie(res, session);
    res.json({
        user: session.user,
        accessToken: session.accessToken,
    });
}
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post("/register", (0, async_handler_1.asyncHandler)(async (req, res) => {
    const input = dto_1.RegisterDto.parse(req.body);
    const session = await identity_service_1.identityService.register(input, meta(req));
    sendSession(res, session);
}));
exports.authRouter.post("/login", (0, async_handler_1.asyncHandler)(async (req, res) => {
    const input = dto_1.LoginDto.parse(req.body);
    const session = await identity_service_1.identityService.login(input, meta(req));
    sendSession(res, session);
}));
exports.authRouter.post("/refresh", (0, async_handler_1.asyncHandler)(async (req, res) => {
    const rt = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
    if (!rt) {
        res.status(401).json({ code: "unauthorized", title: "Missing refresh token" });
        return;
    }
    const session = await identity_service_1.identityService.refresh(rt, meta(req));
    sendSession(res, session);
}));
exports.authRouter.post("/logout", (0, async_handler_1.asyncHandler)(async (req, res) => {
    const rt = req.cookies?.[REFRESH_COOKIE];
    await identity_service_1.identityService.logout(rt);
    clearRefreshCookie(res);
    res.json({ ok: true });
}));
exports.authRouter.get("/me", auth_1.requireAuth, (0, async_handler_1.asyncHandler)(async (req, res) => {
    const user = await identity_service_1.identityService.me(req.user.sub);
    res.json({ user });
}));
exports.authRouter.patch("/me", auth_1.requireAuth, (0, async_handler_1.asyncHandler)(async (req, res) => {
    const patch = dto_1.UpdateProfileDto.parse(req.body);
    const user = await identity_service_1.identityService.updateProfile(req.user.sub, patch);
    res.json({ user });
}));
exports.authRouter.post("/change-password", auth_1.requireAuth, (0, async_handler_1.asyncHandler)(async (req, res) => {
    const input = dto_1.ChangePasswordDto.parse(req.body);
    await identity_service_1.identityService.changePassword(req.user.sub, input);
    clearRefreshCookie(res);
    res.json({ ok: true });
}));
//# sourceMappingURL=auth.routes.js.map