/**
 * Prisma CLI 配置：让命令行工具读取项目根目录 .env，并固定 schema 路径。
 */
import { resolve } from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

const projectRoot = resolve(import.meta.dirname, "../..");

// Prisma CLI 默认从包目录找 .env，这里显式加载项目根目录配置。
config({ path: resolve(projectRoot, ".env") });
config({ path: resolve(import.meta.dirname, ".env"), override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
});
