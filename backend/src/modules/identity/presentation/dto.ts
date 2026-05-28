import { z } from "zod";

export const RegisterDto = z.object({
  fullName: z.string().min(2).max(255),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});
export type RegisterInput = z.infer<typeof RegisterDto>;

export const LoginDto = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof LoginDto>;

export const UpdateProfileDto = z.object({
  fullName: z.string().min(2).max(255).optional(),
  title: z.string().max(255).optional(),
  bio: z.string().max(2000).optional(),
  locale: z.enum(["en", "si"]).optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileDto>;

export const ChangePasswordDto = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "New password must differ from the current one",
    path: ["newPassword"],
  });
export type ChangePasswordInput = z.infer<typeof ChangePasswordDto>;
