/**
 * @Description: Body 滚动锁：统一控制页面级固定高度和滚动禁用，避免各页面互相覆盖恢复值。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import { useEffect } from "react";

let lockCount = 0;
let previousHtmlOverflow = "";
let previousBodyOverflow = "";
let previousBodyHeight = "";

export function useBodyScrollLock(enabled = true) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (lockCount === 0) {
      previousHtmlOverflow = document.documentElement.style.overflow;
      previousBodyOverflow = document.body.style.overflow;
      previousBodyHeight = document.body.style.height;

      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      document.body.style.height = "100dvh";
    }

    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);

      if (lockCount === 0) {
        document.documentElement.style.overflow = previousHtmlOverflow;
        document.body.style.overflow = previousBodyOverflow;
        document.body.style.height = previousBodyHeight;
      }
    };
  }, [enabled]);
}
