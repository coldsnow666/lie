/**
 * Next.js 配置：设置 workspace 根目录，并让前端可编译 shared 包源码。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig = {
  transpilePackages: ["@lie/shared"],
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
