/**
 * @Description: 背景动画本地设置：读写 localStorage 并通知全站背景实时刷新。
 *
 * @Date 2026-06-13 14:47
 */
"use client";

const BACKGROUND_ANIMATION_KEY = "lie.backgroundAnimationEnabled";

export const BACKGROUND_ANIMATION_CHANGE_EVENT = "lie:background-animation-changed";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getBackgroundAnimationEnabled() {
  if (!canUseStorage()) {
    return true;
  }

  return window.localStorage.getItem(BACKGROUND_ANIMATION_KEY) !== "false";
}

export function saveBackgroundAnimationEnabled(enabled: boolean) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(BACKGROUND_ANIMATION_KEY, enabled ? "true" : "false");
  window.dispatchEvent(new CustomEvent(BACKGROUND_ANIMATION_CHANGE_EVENT, { detail: { enabled } }));
}
