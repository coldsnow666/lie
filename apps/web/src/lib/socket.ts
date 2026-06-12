/**
 * @Description: 前端 Socket 封装：统一创建鉴权连接，并提供 ack 风格的 emit 方法。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "./auth";

const SOCKET_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "http://localhost:4000";

let socket: Socket | null = null;
let socketToken: string | null = null;

export function createSocket() {
  const token = getAccessToken();

  if (!token) {
    throw new Error("请先登录");
  }

  if (socket && socketToken !== token) {
    // 登录用户切换后必须重建 Socket，否则服务端仍会按旧 token 对应的用户处理房间事件。
    socket.disconnect();
    socket = null;
    socketToken = null;
  }

  if (socket && socketToken === token) {
    socket.auth = {
      token,
    };

    if (!socket.connected && !socket.active) {
      socket.connect();
    }

    return socket;
  }

  // Socket.IO 鉴权只传 token，不允许前端提交 userId 参与服务端身份判断。
  socket = io(SOCKET_URL, {
    auth: {
      token,
    },
    autoConnect: false,
  });
  socketToken = token;
  socket.connect();

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}

export type Ack<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

export function emitWithAck<T>(event: string, payload: unknown) {
  const activeSocket = createSocket();

  return new Promise<T>((resolve, reject) => {
    // 所有需要响应的 Socket 事件都走 ack，统一处理超时和服务端错误。
    activeSocket.timeout(6000).emit(event, payload, (error: Error | null, response: Ack<T>) => {
      if (error) {
        reject(new Error("连接超时，请稍后重试"));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error?.message ?? "操作失败"));
        return;
      }

      resolve(response.data);
    });
  });
}
