/**
 * 服务端环境配置：读取 .env，并为 Prisma 等只读 process.env 的库回填默认值。
 */
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().default("postgresql://lie:lie_password@localhost:5432/lie"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  GAME_SERVER_PORT: z.coerce.number().int().positive().default(4000),
  JWT_SECRET: z.string().min(8).default("development-jwt-secret"),
  PASSWORD_HASH_SECRET: z.string().default(""),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = envSchema.parse(process.env);

// Prisma 会直接读取 process.env.DATABASE_URL，这里把 Zod 默认值同步回运行时环境。
for (const [key, value] of Object.entries(env)) {
  process.env[key] ??= String(value);
}
