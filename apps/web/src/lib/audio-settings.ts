/**
 * @Description: 游戏音效本地设置：读写 localStorage，并提供全站音效开关查询。
 *
 * @Date 2026-06-13 14:47
 */
"use client";

const GAME_AUDIO_KEY = "lie.gameAudioEnabled";

export const GAME_AUDIO_CHANGE_EVENT = "lie:game-audio-changed";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getGameAudioEnabled() {
  if (!canUseStorage()) {
    return true;
  }

  return window.localStorage.getItem(GAME_AUDIO_KEY) !== "false";
}

export function saveGameAudioEnabled(enabled: boolean) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(GAME_AUDIO_KEY, enabled ? "true" : "false");
  window.dispatchEvent(new CustomEvent(GAME_AUDIO_CHANGE_EVENT, { detail: { enabled } }));
}
