"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cvRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const async_handler_1 = require("@/http/middlewares/async-handler");
const auth_1 = require("@/http/middlewares/auth");
const cv_service_1 = require("@/modules/cv/application/cv-service");
const env_1 = require("@/shared/config/env");
const app_error_1 = require("@/shared/errors/app-error");
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: env_1.env.MAX_UPLOAD_BYTES },
});
exports.cvRouter = (0, express_1.Router)();
exports.cvRouter.use(auth_1.requireAuth);
exports.cvRouter.post("/", upload.single("file"), (0, async_handler_1.asyncHandler)(async (req, res) => {
    if (!req.file)
        throw app_error_1.AppError.badRequest("File is required");
    const cv = await cv_service_1.cvService.upload(req.user.sub, {
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
    });
    res.status(202).json({ cv });
}));
exports.cvRouter.get("/", (0, async_handler_1.asyncHandler)(async (req, res) => {
    const cvs = await cv_service_1.cvService.listForUser(req.user.sub);
    res.json({ items: cvs });
}));
exports.cvRouter.get("/:id", (0, async_handler_1.asyncHandler)(async (req, res) => {
    const cv = await cv_service_1.cvService.getById(req.user.sub, req.params.id);
    res.json({ cv });
}));
exports.cvRouter.delete("/:id", (0, async_handler_1.asyncHandler)(async (req, res) => {
    await cv_service_1.cvService.delete(req.user.sub, req.params.id);
    res.json({ ok: true });
}));
//# sourceMappingURL=cv.routes.js.map