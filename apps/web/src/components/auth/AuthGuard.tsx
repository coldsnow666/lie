/**
 * 登录保护组件：校验本地 token，并在失效时跳转登录页。
 */
"use client";

import { useRouter } from "next/navigation";
import { PropsWithChildren, useEffect, useState } from "react";
import { fetchMe } from "@/lib/api";
import { clearSession, getAccessToken, getStoredUser, type StoredUser } from "@/lib/auth";

type AuthGuardProps = PropsWithChildren<{
  onUser?: (user: StoredUser) => void;
}>;

export default function AuthGuard({ children, onUser }: AuthGuardProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    const storedUser = getStoredUser();
    if (storedUser) {
      // 先展示本地用户信息，再用 /auth/me 校准登录态，减少大厅首屏等待。
      queueMicrotask(() => onUser?.(storedUser));
    }

    fetchMe()
      .then((user) => {
        onUser?.(user);
        setReady(true);
      })
      .catch(() => {
        clearSession();
        router.replace("/login");
      });
  }, [onUser, router]);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1812] text-[#f5e7b0]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d7bc72] border-t-transparent" />
      </div>
    );
  }

  return children;
}
