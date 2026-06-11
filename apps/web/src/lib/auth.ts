/**
 * 前端登录态存储：在 MVP 中使用 localStorage 保存 token 和当前用户。
 */
"use client";

export type StoredUser = {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
};

const TOKEN_KEY = "lie.accessToken";
const USER_KEY = "lie.user";
export const SESSION_CHANGE_EVENT = "lie:session-changed";

type SessionMutationOptions = {
  notify?: boolean;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function notifySessionChanged() {
  if (!canUseStorage()) {
    return;
  }

  window.dispatchEvent(new CustomEvent(SESSION_CHANGE_EVENT));
}

export function saveStoredUser(user: StoredUser, options: SessionMutationOptions = {}) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(USER_KEY, JSON.stringify(user));

  if (options.notify !== false) {
    notifySessionChanged();
  }
}

export function saveSession(accessToken: string, user: StoredUser, options: SessionMutationOptions = {}) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(TOKEN_KEY, accessToken);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));

  if (options.notify !== false) {
    notifySessionChanged();
  }
}

export function getAccessToken() {
  if (!canUseStorage()) {
    return null;
  }

  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): StoredUser | null {
  if (!canUseStorage()) {
    return null;
  }

  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function clearSession(options: SessionMutationOptions = {}) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);

  if (options.notify !== false) {
    notifySessionChanged();
  }
}

export function isLoggedIn() {
  return Boolean(getAccessToken());
}
