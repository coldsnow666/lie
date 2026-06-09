/**
 * 前端 REST 请求封装：统一带 token，并按后端 code/data 协议解析结果。
 */
"use client";

import { clearSession, getAccessToken, saveSession, type StoredUser } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "http://localhost:4000";

type ApiErrorPayload = {
  message: string;
};

type ApiResponse<T> = {
  code: number;
  data: T;
};

export class ApiRequestError extends Error {
  code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
  }
}

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

  const payload = (await response.json().catch(() => null)) as ApiResponse<unknown> | null;

  if (!payload) {
    throw new Error("请求失败");
  }

  if (payload.code >= 40000 || !response.ok) {
    const errorData = payload.data as ApiErrorPayload;
    throw new ApiRequestError(payload.code, errorData.message ?? "请求失败");
  }

  return payload.data as T;
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
  // 登出是本地态优先的操作，服务端 token 已失效或接口暂不可用时也不能阻塞玩家离开。
  try {
    await request<{ success: true }>("/auth/logout", {
      method: "POST",
    });
  } catch {
    return;
  } finally {
    clearSession();
  }
}
