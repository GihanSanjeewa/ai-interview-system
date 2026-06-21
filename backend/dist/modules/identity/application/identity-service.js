"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.identityService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const uuid_1 = require("uuid");
const client_1 = require("@/infrastructure/prisma/client");
const env_1 = require("@/shared/config/env");
const app_error_1 = require("@/shared/errors/app-error");
const token_1 = require("@/modules/identity/domain/token");
function toPublic(u) {
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
async function issueSession(user, meta, familyId) {
    const access = (0, token_1.issueAccessToken)({
        sub: user.id,
        email: user.email,
        role: user.role,
        plan: user.plan,
    });
    const { token: refresh, tokenHash } = (0, token_1.issueRefreshToken)();
    const refreshExpiresAt = new Date(Date.now() + (0, token_1.parseDuration)(env_1.env.JWT_REFRESH_TTL));
    await client_1.prisma.refreshToken.create({
        data: {
            userId: user.id,
            familyId: familyId ?? (0, uuid_1.v4)(),
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
exports.identityService = {
    async register(input, meta) {
        const existing = await client_1.prisma.user.findUnique({ where: { email: input.email } });
        if (existing)
            throw app_error_1.AppError.conflict("Email already registered");
        const passwordHash = await bcryptjs_1.default.hash(input.password, env_1.env.BCRYPT_COST);
        const user = await client_1.prisma.user.create({
            data: {
                email: input.email,
                fullName: input.fullName,
                passwordHash,
            },
        });
        return issueSession(user, meta);
    },
    async login(input, meta) {
        const user = await client_1.prisma.user.findUnique({ where: { email: input.email } });
        if (!user || !user.passwordHash)
            throw app_error_1.AppError.unauthorized("Invalid credentials");
        if (user.status !== "ACTIVE")
            throw app_error_1.AppError.forbidden("Account is not active");
        const ok = await bcryptjs_1.default.compare(input.password, user.passwordHash);
        if (!ok)
            throw app_error_1.AppError.unauthorized("Invalid credentials");
        await client_1.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });
        return issueSession(user, meta);
    },
    async refresh(refreshToken, meta) {
        const hash = (0, token_1.hashRefreshToken)(refreshToken);
        const record = await client_1.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
        if (!record)
            throw app_error_1.AppError.unauthorized("Invalid refresh token");
        if (record.revokedAt) {
            // Reuse of a revoked token → revoke the whole family (token-theft signal).
            await client_1.prisma.refreshToken.updateMany({
                where: { familyId: record.familyId, revokedAt: null },
                data: { revokedAt: new Date() },
            });
            throw app_error_1.AppError.unauthorized("Refresh token reuse detected");
        }
        if (record.expiresAt < new Date())
            throw app_error_1.AppError.unauthorized("Refresh token expired");
        const user = await client_1.prisma.user.findUnique({ where: { id: record.userId } });
        if (!user || user.status !== "ACTIVE")
            throw app_error_1.AppError.unauthorized("Account not available");
        // Rotate: revoke old, issue new in same family.
        await client_1.prisma.refreshToken.update({
            where: { id: record.id },
            data: { revokedAt: new Date() },
        });
        return issueSession(user, meta, record.familyId);
    },
    async logout(refreshToken) {
        if (!refreshToken)
            return;
        const hash = (0, token_1.hashRefreshToken)(refreshToken);
        const record = await client_1.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
        if (!record)
            return;
        await client_1.prisma.refreshToken.updateMany({
            where: { familyId: record.familyId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    },
    async me(userId) {
        const user = await client_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw app_error_1.AppError.notFound("User not found");
        return toPublic(user);
    },
    async updateProfile(userId, patch) {
        const user = await client_1.prisma.user.update({
            where: { id: userId },
            data: patch,
        });
        return toPublic(user);
    },
    async changePassword(userId, input) {
        const user = await client_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.passwordHash)
            throw app_error_1.AppError.notFound("User not found");
        const ok = await bcryptjs_1.default.compare(input.currentPassword, user.passwordHash);
        if (!ok)
            throw app_error_1.AppError.unauthorized("Current password is incorrect");
        const newHash = await bcryptjs_1.default.hash(input.newPassword, env_1.env.BCRYPT_COST);
        await client_1.prisma.user.update({
            where: { id: userId },
            data: { passwordHash: newHash },
        });
        // Revoke all refresh tokens — force re-login everywhere.
        await client_1.prisma.refreshToken.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    },
};
//# sourceMappingURL=identity-service.js.map