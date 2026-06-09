/**
 * 请求入口：统一处理前端 REST 请求、鉴权头和后端 code/data 协议解析。
 */
"use client";

import {
  API_RESPONSE_CODE,
  isErrorResponseCode,
  type ApiEnvelope,
  type ApiErrorData,
  type ApiResponseCode,
} from "@lie/shared";
import { getAccessToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "http://localhost:4000";

export class ApiRequestError extends Error {
  code: ApiResponseCode;

  constructor(code: ApiResponseCode, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
  }
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null;

  if (!payload) {
    throw new Error("请求失败");
  }

  if (isErrorResponseCode(payload.code) || !response.ok) {
    const errorData = payload.data as ApiErrorData;
    const errorCode = response.ok ? payload.code : (payload.code ?? API_RESPONSE_CODE.UNKNOWN_ERROR);
    throw new ApiRequestError(errorCode, errorData.message ?? "请求失败");
  }

  return payload.data as T;
}
