import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "@/shared/config/env";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: "USER" | "ADMIN" | "RECRUITER";
  plan: "FREE" | "PRO" | "TEAM";
}

export const issueAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
    algorithm: "HS256",
  } as SignOptions);

export const verifyAccessToken = (token: string): AccessTokenPayload =>
  jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;

export const issueRefreshToken = (): { token: string; tokenHash: string } => {
  const token = crypto.randomBytes(48).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
};

export const hashRefreshToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

export const parseDuration = (s: string): number => {
  const m = s.match(/^(\d+)([smhd])$/);
  if (!m) throw new Error(`bad duration: ${s}`);
  const n = Number(m[1]);
  switch (m[2]) {
    case "s":
      return n * 1000;
    case "m":
      return n * 60 * 1000;
    case "h":
      return n * 60 * 60 * 1000;
    case "d":
      return n * 24 * 60 * 60 * 1000;
    default:
      throw new Error("unreachable");
  }
};
