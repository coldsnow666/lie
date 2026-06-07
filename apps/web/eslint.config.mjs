/**
 * ESLint 配置：使用 Next.js core web vitals 规则并保留默认忽略项。
 */
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // 覆盖 Next 默认忽略项，避免构建产物参与 lint。
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
