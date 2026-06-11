/**
 * 会话上下文：统一管理登录态初始化、用户缓存校准和跨页面鉴权状态。
 */
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  clearSession,
  getAccessToken,
  getStoredUser,
  saveStoredUser,
  SESSION_CHANGE_EVENT,
  type StoredUser,
} from "@/lib/auth";
import { fetchMe } from "@/service/modules/user";

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

type SessionContextValue = {
  status: SessionStatus;
  user: StoredUser | null;
  refresh: (options?: { silent?: boolean }) => Promise<StoredUser | null>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function applyUnauthenticatedState({
  setStatus,
  setUser,
}: {
  setStatus: (status: SessionStatus) => void;
  setUser: (user: StoredUser | null) => void;
}) {
  setUser(null);
  setStatus("unauthenticated");
}

function applyCachedUserState({
  cachedUser,
  setStatus,
  setUser,
  silent,
}: {
  cachedUser: StoredUser | null;
  setStatus: (status: SessionStatus) => void;
  setUser: (user: StoredUser | null) => void;
  silent: boolean;
}) {
  if (cachedUser) {
    setUser(cachedUser);
    if (!silent) {
      setStatus("loading");
    }
    return;
  }

  setStatus("loading");
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<StoredUser | null>(null);
  const refreshTicketRef = useRef(0);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    const token = getAccessToken();
    const refreshTicket = ++refreshTicketRef.current;
    const silent = options?.silent ?? false;

    if (!token) {
      applyUnauthenticatedState({ setStatus, setUser });
      return null;
    }

    applyCachedUserState({
      cachedUser: getStoredUser(),
      setStatus,
      setUser,
      silent,
    });

    try {
      const nextUser = await fetchMe();

      if (refreshTicket !== refreshTicketRef.current) {
        return nextUser;
      }

      saveStoredUser(nextUser, { notify: false });
      setUser(nextUser);
      setStatus("authenticated");
      return nextUser;
    } catch {
      if (refreshTicket !== refreshTicketRef.current) {
        return null;
      }

      clearSession({ notify: false });
      applyUnauthenticatedState({ setStatus, setUser });
      return null;
    }
  }, []);

  useEffect(() => {
    const bootstrapTimer = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => {
      window.clearTimeout(bootstrapTimer);
    };
  }, [refresh]);

  useEffect(() => {
    function handleSessionChanged() {
      const cachedUser = getStoredUser();
      setUser(cachedUser);
      void refresh({ silent: Boolean(cachedUser) });
    }

    window.addEventListener(SESSION_CHANGE_EVENT, handleSessionChanged);
    return () => window.removeEventListener(SESSION_CHANGE_EVENT, handleSessionChanged);
  }, [refresh]);

  const value = useMemo(
    () => ({
      status,
      user,
      refresh,
    }),
    [refresh, status, user],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession 必须在 SessionProvider 内使用");
  }

  return context;
}
