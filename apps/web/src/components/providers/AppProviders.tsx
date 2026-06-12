/**
 * @Description: 应用级 Provider 入口：统一挂载会话、路由 loading 等跨页面上下文。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "@/features/auth/SessionProvider";
import { RouteLoadingProvider } from "@/components/loading/RouteLoadingProvider";
import { PixelMessageHost } from "@/components/ui/PixelMessage";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <RouteLoadingProvider>
        {children}
        <PixelMessageHost />
      </RouteLoadingProvider>
    </SessionProvider>
  );
}
