"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.audioRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const uuid_1 = require("uuid");
const async_handler_1 = require("@/http/middlewares/async-handler");
const auth_1 = require("@/http/middlewares/auth");
const ml_client_1 = require("@/infrastructure/ml/ml-client");
const env_1 = require("@/shared/config/env");
const app_error_1 = require("@/shared/errors/app-error");
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
});
exports.audioRouter = (0, express_1.Router)();
exports.audioRouter.use(auth_1.requireAuth);
exports.audioRouter.post("/transcribe", upload.single("audio"), (0, async_handler_1.asyncHandler)(async (req, res) => {
    if (!req.file)
        throw app_error_1.AppError.badRequest("audio is required");
    const language = req.body?.language || "en";
    const dir = node_path_1.default.join(env_1.env.UPLOAD_DIR, "audio", req.user.sub);
    await promises_1.default.mkdir(dir, { recursive: true });
    const tmp = node_path_1.default.join(dir, `${(0, uuid_1.v4)()}-${req.file.originalname || "blob.webm"}`);
    await promises_1.default.writeFile(tmp, req.file.buffer);
    try {
        const text = await ml_client_1.mlClient.transcribe(tmp, language);
        res.json({ text });
    }
    finally {
        // Keep audio for now (could move to S3 + clean after retention window).
    }
}));
//# sourceMappingURL=audio.routes.js.map