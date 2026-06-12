/**
 * @Description: 登录保护组件：消费全局会话状态，并在未登录时跳转登录页。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import { useRouter } from "next/navigation";
import { PropsWithChildren, useEffect } from "react";
import { useSession } from "@/features/auth/SessionProvider";
import type { StoredUser } from "@/lib/auth";

type AuthGuardProps = PropsWithChildren<{
  onReady?: () => void;
  onUser?: (user: StoredUser) => void;
}>;

export default function AuthGuard({ children, onReady, onUser }: AuthGuardProps) {
  const router = useRouter();
  const { status, user } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status]);

  useEffect(() => {
    if (status === "authenticated" && user) {
      onUser?.(user);
      onReady?.();
    }
  }, [onReady, onUser, status, user]);

  if (status !== "authenticated") {
    return (
      <div className="grid min-h-screen place-items-center text-[#f5e7b0]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d7bc72] border-t-transparent" />
      </div>
    );
  }

  return children;
}
