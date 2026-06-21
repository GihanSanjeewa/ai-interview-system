"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
require("dotenv/config");
const zod_1 = require("zod");
const schema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "test", "production"]).default("development"),
    PORT: zod_1.z.coerce.number().default(5000),
    LOG_LEVEL: zod_1.z.string().default("info"),
    APP_URL: zod_1.z.string().default("http://localhost:5173"),
    API_URL: zod_1.z.string().default("http://localhost:5000"),
    DATABASE_URL: zod_1.z.string(),
    JWT_ACCESS_SECRET: zod_1.z.string().min(32),
    JWT_REFRESH_SECRET: zod_1.z.string().min(32),
    JWT_ACCESS_TTL: zod_1.z.string().default("15m"),
    JWT_REFRESH_TTL: zod_1.z.string().default("30d"),
    BCRYPT_COST: zod_1.z.coerce.number().default(12),
    COOKIE_DOMAIN: zod_1.z.string().default("localhost"),
    COOKIE_SECURE: zod_1.z
        .string()
        .default("false")
        .transform((v) => v === "true"),
    ML_SERVICE_URL: zod_1.z.string().default("http://localhost:5001"),
    UPLOAD_DIR: zod_1.z.string().default("./uploads"),
    MAX_UPLOAD_BYTES: zod_1.z.coerce.number().default(10 * 1024 * 1024),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
    process.exit(1);
}
exports.env = parsed.data;
//# sourceMappingURL=env.js.map