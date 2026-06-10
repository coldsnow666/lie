/**
 * 文件说明：管理跨路由的大厅进入 Loading 状态。
 */
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import RouteLoadingOverlay from "@/components/start/RouteLoadingOverlay";

type RouteLoadingPhase = "opening" | "waiting" | "closing";

type RouteLoadingContextValue = {
  begin: () => void;
  complete: () => void;
  cancel: () => void;
};

const LOADING_TRANSITION_DURATION = 1200;
const OPENING_DURATION = LOADING_TRANSITION_DURATION;
const CLOSING_DURATION = LOADING_TRANSITION_DURATION;
const RouteLoadingContext = createContext<RouteLoadingContextValue | null>(null);

export function RouteLoadingProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<RouteLoadingPhase>("opening");
  const phaseRef = useRef<RouteLoadingPhase>("opening");
  const visibleRef = useRef(false);
  const startedAtRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const pushTimer = useCallback((callback: () => void, timeout: number) => {
    const timer = window.setTimeout(callback, timeout);
    timersRef.current.push(timer);
  }, []);

  const cancel = useCallback(() => {
    clearTimers();
    visibleRef.current = false;
    setVisible(false);
    setPhase("opening");
    phaseRef.current = "opening";
  }, [clearTimers]);

  const begin = useCallback(() => {
    clearTimers();
    startedAtRef.current = window.performance.now();
    phaseRef.current = "opening";
    setPhase("opening");
    visibleRef.current = true;
    setVisible(true);
    pushTimer(() => {
      if (phaseRef.current === "opening") {
        phaseRef.current = "waiting";
        setPhase("waiting");
      }
    }, OPENING_DURATION);
  }, [clearTimers, pushTimer]);

  const complete = useCallback(() => {
    if (!visibleRef.current || phaseRef.current === "closing") {
      return;
    }

    const close = () => {
      clearTimers();
      phaseRef.current = "closing";
      setPhase("closing");
      pushTimer(() => {
        visibleRef.current = false;
        setVisible(false);
        phaseRef.current = "opening";
        setPhase("opening");
      }, CLOSING_DURATION);
    };

    const elapsed = window.performance.now() - startedAtRef.current;
    const remainingOpeningTime = Math.max(0, OPENING_DURATION - elapsed);

    if (remainingOpeningTime > 0 && phaseRef.current === "opening") {
      pushTimer(close, remainingOpeningTime);
      return;
    }

    close();
  }, [clearTimers, pushTimer]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const value = useMemo(() => ({ begin, complete, cancel }), [begin, complete, cancel]);

  return (
    <RouteLoadingContext.Provider value={value}>
      {children}
      {visible ? <RouteLoadingOverlay phase={phase} transitionDuration={LOADING_TRANSITION_DURATION} /> : null}
    </RouteLoadingContext.Provider>
  );
}

export function useRouteLoading() {
  const context = useContext(RouteLoadingContext);

  if (!context) {
    throw new Error("useRouteLoading must be used within RouteLoadingProvider");
  }

  return context;
}
