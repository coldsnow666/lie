/**
 * 游戏请求模块：封装房间相关 REST 请求，供大厅和房间页面按需复用。
 */
"use client";

import { type PublicGameEvent, type PublicGameState } from "@lie/shared";
import { API_URL, authHeader, request } from "../index";

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

export type RoomSyncPayload = {
  room: PublicRoom;
  gameState: PublicGameState | null;
};

export async function fetchRooms() {
  const data = await request<{ rooms: PublicRoom[] }>("/rooms");
  return data.rooms;
}

export async function createRoom(input: { roomCode?: string; maxPlayers: 2 | 3 }) {
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
  // 退出请求改走标准 Authorization 头，避免把 token 暴露在 URL、代理日志和浏览器历史里。
  void fetch(`${API_URL}/rooms/${roomId}/leave`, {
    method: "POST",
    keepalive: true,
    headers: authHeader(),
  }).catch(() => {
    // 页面正在卸载时无法可靠展示错误；服务端断线清理仍会兜底。
  });
}
