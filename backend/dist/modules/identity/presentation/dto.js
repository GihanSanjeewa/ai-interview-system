"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangePasswordDto = exports.UpdateProfileDto = exports.LoginDto = exports.RegisterDto = void 0;
const zod_1 = require("zod");
exports.RegisterDto = zod_1.z.object({
    fullName: zod_1.z.string().min(2).max(255),
    email: zod_1.z.string().email().max(255),
    password: zod_1.z.string().min(8).max(128),
});
exports.LoginDto = zod_1.z.object({
    email: zod_1.z.string().email().max(255),
    password: zod_1.z.string().min(1).max(128),
});
exports.UpdateProfileDto = zod_1.z.object({
    fullName: zod_1.z.string().min(2).max(255).optional(),
    title: zod_1.z.string().max(255).optional(),
    bio: zod_1.z.string().max(2000).optional(),
    locale: zod_1.z.enum(["en", "si"]).optional(),
    avatarUrl: zod_1.z.string().url().max(500).nullable().optional(),
});
exports.ChangePasswordDto = zod_1.z
    .object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: zod_1.z.string().min(8).max(128),
})
    .refine((d) => d.currentPassword !== d.newPassword, {
    message: "New password must differ from the current one",
    path: ["newPassword"],
});
//# sourceMappingURL=dto.js.map