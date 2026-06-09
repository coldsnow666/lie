/**
 * 游戏请求模块：封装房间相关 REST 请求，供大厅和房间页面按需复用。
 */
"use client";

import { type PublicGameEvent } from "@lie/shared";
import { request } from "../index";

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

export async function createRoom(input: { roomCode?: string } = {}) {
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
