/**
 * 应用级 Provider 入口：统一挂载会话、路由 loading 等跨页面上下文。
 */
"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { RouteLoadingProvider } from "@/components/loading/RouteLoadingProvider";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <RouteLoadingProvider>{children}</RouteLoadingProvider>
    </SessionProvider>
  );
}
