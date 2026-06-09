/**
 * 认证页转场上下文：让登录和注册表单复用布局层的统一退场动画。
 */
"use client";

import { createContext, useContext, type ReactNode } from "react";

type AuthTransitionContextValue = {
  navigateHome: () => void;
  transitioning: boolean;
};

const AuthTransitionContext = createContext<AuthTransitionContextValue | null>(null);

export function AuthTransitionProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: AuthTransitionContextValue;
}) {
  return <AuthTransitionContext.Provider value={value}>{children}</AuthTransitionContext.Provider>;
}

export function useAuthTransition() {
  const context = useContext(AuthTransitionContext);

  if (!context) {
    throw new Error("useAuthTransition 必须在 AuthTransitionProvider 内使用");
  }

  return context;
}
