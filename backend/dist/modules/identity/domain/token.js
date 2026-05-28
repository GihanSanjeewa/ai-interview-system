"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDuration = exports.hashRefreshToken = exports.issueRefreshToken = exports.verifyAccessToken = exports.issueAccessToken = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("@/shared/config/env");
const issueAccessToken = (payload) => jsonwebtoken_1.default.sign(payload, env_1.env.JWT_ACCESS_SECRET, {
    expiresIn: env_1.env.JWT_ACCESS_TTL,
    algorithm: "HS256",
});
exports.issueAccessToken = issueAccessToken;
const verifyAccessToken = (token) => jsonwebtoken_1.default.verify(token, env_1.env.JWT_ACCESS_SECRET);
exports.verifyAccessToken = verifyAccessToken;
const issueRefreshToken = () => {
    const token = node_crypto_1.default.randomBytes(48).toString("base64url");
    const tokenHash = node_crypto_1.default.createHash("sha256").update(token).digest("hex");
    return { token, tokenHash };
};
exports.issueRefreshToken = issueRefreshToken;
const hashRefreshToken = (token) => node_crypto_1.default.createHash("sha256").update(token).digest("hex");
exports.hashRefreshToken = hashRefreshToken;
const parseDuration = (s) => {
    const m = s.match(/^(\d+)([smhd])$/);
    if (!m)
        throw new Error(`bad duration: ${s}`);
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
exports.parseDuration = parseDuration;
//# sourceMappingURL=token.js.map