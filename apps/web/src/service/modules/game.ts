/**
 * 游戏请求模块：封装房间相关 REST 请求，供大厅和房间页面按需复用。
 */
"use client";

import { type PublicGameEvent } from "@lie/shared";
import { getAccessToken } from "@/lib/auth";
import { API_URL, request } from "../index";

export type PublicRoomPlayer = {
  playerId: string;
  userId: string;
  nickname: string;
  seatIndex: number;
  connected: boolean;
  ready: boolean;
};

export type PublicRoom = {
  id: string;
  code: string;
  status: "waiting" | "playing" | "finished";
  ownerUserId: string | null;
  maxPlayers: number;
  players: Array<PublicRoomPlayer>;
  events: PublicGameEvent[];
  gameStarted?: boolean;
  updatedAt?: number;
};

export async function fetchRooms() {
  const data = await request<{ rooms: PublicRoom[] }>("/rooms");
  return data.rooms;
}

export async function createRoom(input: { roomCode?: string; maxPlayers: 2 | 3 | 4 }) {
  const data = await request<{ room: PublicRoom }>("/rooms", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.room;
}

export async function joinRoom(input: { roomCode: string }) {
  const data = await request<{ room: PublicRoom }>("/rooms/join", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.room;
}

export async function fetchRoom(roomId: string) {
  const data = await request<{ room: PublicRoom }>(`/rooms/${roomId}`);
  return data.room;
}

export async function leaveRoomByHttp(roomId: string) {
  const data = await request<{ room: PublicRoom | null }>(`/rooms/${roomId}/leave`, {
    method: "POST",
  });
  return data.room;
}

export function leaveRoomOnPageExit(roomId: string) {
  const token = getAccessToken();
  if (!token) {
    return;
  }

  const url = `${API_URL}/rooms/${roomId}/leave-beacon?token=${encodeURIComponent(token)}`;

  // sendBeacon 返回 true 只代表浏览器已排队，不代表服务端一定处理成功；
  // 退出接口是幂等的，因此同时补一个 keepalive fetch 来提高刷新/关闭页签时的到达率。
  navigator.sendBeacon?.(url);

  void fetch(url, {
    method: "POST",
    keepalive: true,
  }).catch(() => {
    // 页面正在卸载时无法可靠展示错误；服务端断线清理仍会兜底。
  });
}
