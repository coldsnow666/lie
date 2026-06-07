/**
 * 前端 REST 请求封装：统一带 token、解析错误并暴露语义化认证方法。
 */
"use client";

import { clearSession, getAccessToken, saveSession, type StoredUser } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "http://localhost:4000";

type ApiError = {
  error?: {
    code: string;
    message: string;
  };
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  // 所有 REST 请求都从这里补 Authorization，页面组件不要直接拼接 token。
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = (await response.json().catch(() => ({}))) as T & ApiError;

  if (!response.ok) {
    throw new Error(data.error?.message ?? "请求失败");
  }

  return data;
}

export type AuthResponse = {
  user: StoredUser;
  accessToken: string;
};

export async function register(input: { email: string; nickname: string; password: string }) {
  const data = await request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });

  saveSession(data.accessToken, data.user);
  return data;
}

export async function login(input: { email: string; password: string }) {
  const data = await request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });

  saveSession(data.accessToken, data.user);
  return data;
}

export async function fetchMe() {
  const data = await request<{ user: StoredUser }>("/auth/me");
  return data.user;
}

export async function logout() {
  // 退出接口失败时也要清本地登录态，避免用户被卡在半登录状态。
  try {
    await request<{ ok: true }>("/auth/logout", {
      method: "POST",
    });
  } finally {
    clearSession();
  }
}
