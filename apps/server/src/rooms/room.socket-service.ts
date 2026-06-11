/**
 * 文件说明：面向 Socket 入口封装房间业务结果与实时副作用计划，避免在 socket.ts 中手写广播编排。
 */
import { toPublicGameState, type DeclaredRank } from "@lie/shared";
import type { AuthUser } from "../auth/token";
import {
  challengeRoomLastPlay,
  createRoom,
  handleSocketDisconnect,
  joinRoom,
  leaveRoom,
  playRoomCards,
  serializeRoom,
  setReady,
  startGame,
  syncRoomPlayer,
} from "./room.service";
import type { RoomRealtimeEffect } from "./room.realtime";
import type { RoomState } from "./room.store";

export type RoomSocketCommandResult<T> = {
  data: T;
  effects: RoomRealtimeEffect[];
};

function serializeGameStateForUser(room: RoomState | null, userId: string) {
  const player = room?.players.find((candidate) => candidate.userId === userId);

  if (!room?.gameState || !player) {
    return null;
  }

  return toPublicGameState(room.gameState, player.playerId);
}

export function subscribeLobbyForSocket(): RoomSocketCommandResult<Record<string, never>> {
  return {
    data: {},
    effects: [{ type: "join-lobby" }, { type: "emit-lobby-updated" }],
  };
}

export function unsubscribeLobbyForSocket(): RoomSocketCommandResult<Record<string, never>> {
  return {
    data: {},
    effects: [{ type: "leave-lobby" }],
  };
}

export async function createRoomForSocket(
  user: AuthUser,
  options: {
    roomCode?: string;
    maxPlayers: 2 | 3;
  },
  socketId: string,
): Promise<RoomSocketCommandResult<{ room: ReturnType<typeof serializeRoom> }>> {
  const room = await createRoom(user, options, socketId);

  return {
    data: { room: serializeRoom(room) },
    effects: [
      { type: "join-room", roomId: room.id },
      { type: "emit-room-updated", roomId: room.id },
      { type: "emit-lobby-updated" },
    ],
  };
}

export async function joinRoomForSocket(
  roomCode: string,
  user: AuthUser,
  socketId: string,
): Promise<RoomSocketCommandResult<{ room: ReturnType<typeof serializeRoom> }>> {
  const room = await joinRoom(roomCode, user, socketId);

  return {
    data: { room: serializeRoom(room) },
    effects: [
      { type: "join-room", roomId: room.id },
      { type: "emit-room-updated", roomId: room.id },
      { type: "emit-lobby-updated" },
    ],
  };
}

export async function leaveRoomForSocket(
  roomId: string,
  user: AuthUser,
): Promise<RoomSocketCommandResult<{ room: ReturnType<typeof serializeRoom> | null }>> {
  const room = await leaveRoom(roomId, user);

  return {
    data: { room: room ? serializeRoom(room) : null },
    effects: [
      { type: "leave-room", roomId },
      ...(room ? ([{ type: "emit-room-updated", roomId: room.id }] satisfies RoomRealtimeEffect[]) : []),
      { type: "emit-lobby-updated" },
    ],
  };
}

export async function setReadyForSocket(
  roomId: string,
  user: AuthUser,
  ready: boolean,
): Promise<RoomSocketCommandResult<{ room: ReturnType<typeof serializeRoom> }>> {
  const room = await setReady(roomId, user, ready);

  return {
    data: { room: serializeRoom(room) },
    effects: [
      { type: "emit-room-updated", roomId: room.id },
      { type: "emit-lobby-updated" },
    ],
  };
}

export async function startGameForSocket(
  roomId: string,
  user: AuthUser,
): Promise<RoomSocketCommandResult<{ room: ReturnType<typeof serializeRoom>; gameState: ReturnType<typeof serializeGameStateForUser> }>> {
  const room = await startGame(roomId, user);

  return {
    data: {
      room: serializeRoom(room),
      gameState: serializeGameStateForUser(room, user.id),
    },
    effects: [
      { type: "emit-room-updated", roomId: room.id },
      { type: "emit-game-updated", roomId: room.id },
      { type: "emit-lobby-updated" },
    ],
  };
}

export async function playCardsForSocket(
  roomId: string,
  user: AuthUser,
  cardIds: string[],
  declaredRank?: DeclaredRank,
): Promise<RoomSocketCommandResult<{ event: Awaited<ReturnType<typeof playRoomCards>>["event"] }>> {
  const { room, event } = await playRoomCards(roomId, user, cardIds, declaredRank);

  return {
    data: { event },
    effects: [
      { type: "emit-game-updated", roomId: room.id },
      { type: "emit-lobby-updated" },
      ...(event ? ([{ type: "emit-game-event", roomId: room.id, event }] satisfies RoomRealtimeEffect[]) : []),
      ...(room.gameState?.winnerPlayerId
        ? ([{ type: "emit-game-finished", roomId: room.id, winnerPlayerId: room.gameState.winnerPlayerId }] satisfies RoomRealtimeEffect[])
        : []),
    ],
  };
}

export async function challengeRoomForSocket(
  roomId: string,
  user: AuthUser,
): Promise<RoomSocketCommandResult<{ event: Awaited<ReturnType<typeof challengeRoomLastPlay>>["event"] }>> {
  const { room, event } = await challengeRoomLastPlay(roomId, user);

  return {
    data: { event },
    effects: [
      { type: "emit-game-updated", roomId: room.id },
      { type: "emit-lobby-updated" },
      { type: "emit-game-event", roomId: room.id, event },
      { type: "emit-game-challenge-resolved", roomId: room.id, event },
    ],
  };
}

export async function syncRoomForSocket(
  roomId: string,
  user: AuthUser,
  socketId: string,
): Promise<RoomSocketCommandResult<{ room: ReturnType<typeof serializeRoom>; gameState: ReturnType<typeof serializeGameStateForUser> }>> {
  const room = await syncRoomPlayer(roomId, user, socketId);

  return {
    data: {
      room: serializeRoom(room),
      gameState: serializeGameStateForUser(room, user.id),
    },
    effects: [
      { type: "join-room", roomId: room.id },
      { type: "emit-room-updated", roomId: room.id },
      { type: "emit-game-updated", roomId: room.id },
      { type: "emit-lobby-updated" },
    ],
  };
}

export async function handleDisconnectForSocket(socketId: string): Promise<RoomSocketCommandResult<Record<string, never>>> {
  const rooms = await handleSocketDisconnect(socketId);

  return {
    data: {},
    effects: [
      ...rooms.map((room) => ({ type: "emit-room-updated", roomId: room.id }) satisfies RoomRealtimeEffect),
      { type: "emit-lobby-updated" },
    ],
  };
}
