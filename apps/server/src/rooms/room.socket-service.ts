/**
 * @Description: 面向 Socket 入口封装房间业务结果与实时副作用计划，避免在 socket.ts 中手写广播编排。
 *
 * @Date 2026-06-12 14:47
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

/**
 * @Description: 以当前用户视角序列化游戏状态，只返回该玩家可见的手牌信息。
 *
 * @param room 房间热状态，可能已被删除。
 * @param userId 当前 Socket 用户 ID。
 * @return 当前用户的公开游戏状态，不在房间或未开局时返回 null。
 *
 * @Date 2026-06-12 14:47
 */
function serializeGameStateForUser(room: RoomState | null, userId: string) {
  const player = room?.players.find((candidate) => candidate.userId === userId);

  if (!room?.gameState || !player) {
    return null;
  }

  return toPublicGameState(room.gameState, player.playerId);
}

/**
 * @Description: 生成大厅订阅命令，同时触发一次大厅列表刷新作为订阅 ack 数据。
 *
 * @return Socket 命令结果和实时副作用计划。
 *
 * @Date 2026-06-12 14:47
 */
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

/**
 * @Description: Socket 创建房间入口，业务写入后只返回可公开的房间数据和副作用计划。
 *
 * @param user 当前 Socket 用户。
 * @param options 创建房间参数。
 * @param socketId 当前 Socket 连接 ID。
 * @return 创建房间 ack 数据和需要执行的实时副作用。
 *
 * @Date 2026-06-12 14:47
 */
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

/**
 * @Description: Socket 开局入口，返回当前用户视角的游戏状态并安排逐玩家单播。
 *
 * @param roomId 房间 ID。
 * @param user 当前 Socket 用户。
 * @return 开局 ack 数据和实时副作用计划。
 *
 * @Date 2026-06-12 14:47
 */
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

/**
 * @Description: Socket 出牌入口，把待定胜利确认、普通出牌和游戏结束广播统一成副作用计划。
 *
 * @param roomId 房间 ID。
 * @param user 当前 Socket 用户。
 * @param cardIds 选择的手牌 ID，待定胜利确认时为空数组。
 * @param declaredRank 首次出牌声明的牌点。
 * @return 出牌 ack 数据和实时副作用计划。
 *
 * @Date 2026-06-12 14:47
 */
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

/**
 * @Description: Socket 质疑入口，同时广播通用游戏事件和质疑专用动画事件。
 *
 * @param roomId 房间 ID。
 * @param user 当前 Socket 用户。
 * @return 质疑 ack 数据和实时副作用计划。
 *
 * @Date 2026-06-12 14:47
 */
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

/**
 * @Description: Socket 同步入口，处理重连后的房间加入、公开房间状态和个人游戏状态刷新。
 *
 * @param roomId 房间 ID。
 * @param user 当前 Socket 用户。
 * @param socketId 当前 Socket 连接 ID。
 * @return 同步 ack 数据和实时副作用计划。
 *
 * @Date 2026-06-12 14:47
 */
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
