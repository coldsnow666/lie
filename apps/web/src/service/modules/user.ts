/**
 * 用户请求模块：封装注册、登录、当前用户和退出登录相关的 REST 请求。
 */
"use client";

import { clearSession, saveSession, type StoredUser } from "@/lib/auth";
import { request } from "../index";

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
