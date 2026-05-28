import { Router } from "express";
import type { Request, Response } from "express";
import { asyncHandler } from "@/http/middlewares/async-handler";
import { requireAuth } from "@/http/middlewares/auth";
import { identityService, type AuthSession } from "@/modules/identity/application/identity-service";
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  UpdateProfileDto,
} from "@/modules/identity/presentation/dto";
import { env } from "@/shared/config/env";

const REFRESH_COOKIE = "iv_rt";

function meta(req: Request) {
  return {
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

function setRefreshCookie(res: Response, session: AuthSession) {
  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: env.COOKIE_SECURE,
    domain: env.COOKIE_DOMAIN,
    path: "/api/v1/auth",
    expires: session.refreshExpiresAt,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    sameSite: "strict",
    secure: env.COOKIE_SECURE,
    domain: env.COOKIE_DOMAIN,
    path: "/api/v1/auth",
  });
}

function sendSession(res: Response, session: AuthSession) {
  setRefreshCookie(res, session);
  res.json({
    user: session.user,
    accessToken: session.accessToken,
  });
}

export const authRouter = Router();

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = RegisterDto.parse(req.body);
    const session = await identityService.register(input, meta(req));
    sendSession(res, session);
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = LoginDto.parse(req.body);
    const session = await identityService.login(input, meta(req));
    sendSession(res, session);
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const rt = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
    if (!rt) {
      res.status(401).json({ code: "unauthorized", title: "Missing refresh token" });
      return;
    }
    const session = await identityService.refresh(rt, meta(req));
    sendSession(res, session);
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const rt = req.cookies?.[REFRESH_COOKIE];
    await identityService.logout(rt);
    clearRefreshCookie(res);
    res.json({ ok: true });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await identityService.me(req.user!.sub);
    res.json({ user });
  })
);

authRouter.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const patch = UpdateProfileDto.parse(req.body);
    const user = await identityService.updateProfile(req.user!.sub, patch);
    res.json({ user });
  })
);

authRouter.post(
  "/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = ChangePasswordDto.parse(req.body);
    await identityService.changePassword(req.user!.sub, input);
    clearRefreshCookie(res);
    res.json({ ok: true });
  })
);
