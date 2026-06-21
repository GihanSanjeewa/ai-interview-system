import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { prisma } from "@/infrastructure/prisma/client";
import { env } from "@/shared/config/env";
import { AppError } from "@/shared/errors/app-error";
import {
  hashRefreshToken,
  issueAccessToken,
  issueRefreshToken,
  parseDuration,
  type AccessTokenPayload,
} from "@/modules/identity/domain/token";
import type {
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
  ChangePasswordInput,
} from "@/modules/identity/presentation/dto";

export interface AuthSession {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  title: string | null;
  bio: string | null;
  locale: string;
  role: "USER" | "ADMIN" | "RECRUITER";
  plan: "FREE" | "PRO" | "TEAM";
  createdAt: Date;
}

function toPublic(u: {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  title: string | null;
  bio: string | null;
  locale: string;
  role: "USER" | "ADMIN" | "RECRUITER";
  plan: "FREE" | "PRO" | "TEAM";
  createdAt: Date;
}): PublicUser {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    avatarUrl: u.avatarUrl,
    title: u.title,
    bio: u.bio,
    locale: u.locale,
    role: u.role,
    plan: u.plan,
    createdAt: u.createdAt,
  };
}

interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

async function issueSession(
  user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
    title: string | null;
    bio: string | null;
    locale: string;
    role: "USER" | "ADMIN" | "RECRUITER";
    plan: "FREE" | "PRO" | "TEAM";
    createdAt: Date;
  },
  meta: SessionMeta,
  familyId?: string
): Promise<AuthSession> {
  const access = issueAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    plan: user.plan,
  } satisfies AccessTokenPayload);

  const { token: refresh, tokenHash } = issueRefreshToken();
  const refreshExpiresAt = new Date(Date.now() + parseDuration(env.JWT_REFRESH_TTL));

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      familyId: familyId ?? uuid(),
      tokenHash,
      expiresAt: refreshExpiresAt,
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });

  return {
    user: toPublic(user),
    accessToken: access,
    refreshToken: refresh,
    refreshExpiresAt,
  };
}

export const identityService = {
  async register(input: RegisterInput, meta: SessionMeta): Promise<AuthSession> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw AppError.conflict("Email already registered");

    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_COST);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        fullName: input.fullName,
        passwordHash,
      },
    });

    return issueSession(user, meta);
  },

  async login(input: LoginInput, meta: SessionMeta): Promise<AuthSession> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !user.passwordHash) throw AppError.unauthorized("Invalid credentials");
    if (user.status !== "ACTIVE") throw AppError.forbidden("Account is not active");

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw AppError.unauthorized("Invalid credentials");

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return issueSession(user, meta);
  },

  async refresh(refreshToken: string, meta: SessionMeta): Promise<AuthSession> {
    const hash = hashRefreshToken(refreshToken);
    const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!record) throw AppError.unauthorized("Invalid refresh token");

    if (record.revokedAt) {
      // Reuse of a revoked token → revoke the whole family (token-theft signal).
      await prisma.refreshToken.updateMany({
        where: { familyId: record.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw AppError.unauthorized("Refresh token reuse detected");
    }
    if (record.expiresAt < new Date()) throw AppError.unauthorized("Refresh token expired");

    const user = await prisma.user.findUnique({ where: { id: record.userId } });
    if (!user || user.status !== "ACTIVE") throw AppError.unauthorized("Account not available");

    // Rotate: revoke old, issue new in same family.
    await prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return issueSession(user, meta, record.familyId);
  },

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const hash = hashRefreshToken(refreshToken);
    const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!record) return;
    await prisma.refreshToken.updateMany({
      where: { familyId: record.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async me(userId: string): Promise<PublicUser> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound("User not found");
    return toPublic(user);
  },

  async updateProfile(userId: string, patch: UpdateProfileInput): Promise<PublicUser> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: patch,
    });
    return toPublic(user);
  },

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) throw AppError.notFound("User not found");
    const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!ok) throw AppError.unauthorized("Current password is incorrect");
    const newHash = await bcrypt.hash(input.newPassword, env.BCRYPT_COST);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });
    // Revoke all refresh tokens — force re-login everywhere.
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
