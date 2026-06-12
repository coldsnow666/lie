/**
 * @Description: 统一执行房间领域结果对应的 Socket 实时副作用，避免在 socket.ts 中分散拼装广播逻辑。
 *
 * @Date 2026-06-12 14:47
 */
import { type PublicGameEvent, toPublicGameState } from "@lie/shared";
import { type Server, type Socket } from "socket.io";
import { SERVER_EVENTS } from "../events/server-events";
import { getRoomById } from "./room.store";
import { listPublicRooms, serializeRoom } from "./room.service";

export const LOBBY_WATCHERS_ROOM = "lobby:watchers";

export type RoomRealtimeEffect =
  | { type: "join-lobby" }
  | { type: "leave-lobby" }
  | { type: "join-room"; roomId: string }
  | { type: "leave-room"; roomId: string }
  | { type: "emit-room-updated"; roomId: string }
  | { type: "emit-lobby-updated" }
  | { type: "emit-game-updated"; roomId: string }
  | { type: "emit-game-event"; roomId: string; event: PublicGameEvent }
  | { type: "emit-game-challenge-resolved"; roomId: string; event: PublicGameEvent }
  | { type: "emit-game-finished"; roomId: string; winnerPlayerId: string };

export type RoomRealtimeEffectResult = {
  lobbyRooms?: Awaited<ReturnType<typeof listPublicRooms>>;
};

/**
 * @Description: 广播房间公开状态，房间已被删除时静默跳过。
 *
 * @param io Socket.IO server。
 * @param roomId 房间 ID。
 * @return 广播完成。
 *
 * @Date 2026-06-12 14:47
 */
async function emitRoomUpdated(io: Server, roomId: string) {
  const room = await getRoomById(roomId);
  if (!room) {
    return;
  }

  io.to(room.id).emit(SERVER_EVENTS.ROOM_UPDATED, serializeRoom(room));
}

/**
 * @Description: 刷新大厅房间列表并广播给所有大厅订阅者。
 *
 * @param io Socket.IO server。
 * @return 最新大厅公开房间列表，供订阅 ack 直接复用。
 *
 * @Date 2026-06-12 14:47
 */
async function emitLobbyRoomsUpdated(io: Server) {
  const rooms = await listPublicRooms();
  io.to(LOBBY_WATCHERS_ROOM).emit(SERVER_EVENTS.LOBBY_ROOMS_UPDATED, rooms);
  return rooms;
}

/**
 * @Description: 按玩家逐个单播游戏状态，确保 selfHand 只发送给对应玩家。
 *
 * @param io Socket.IO server。
 * @param roomId 房间 ID。
 * @return 单播完成。
 *
 * @Date 2026-06-12 14:47
 */
async function emitGameUpdated(io: Server, roomId: string) {
  const room = await getRoomById(roomId);
  if (!room?.gameState) {
    return;
  }

  for (const player of room.players) {
    if (player.socketId) {
      // 每个玩家收到的 selfHand 不同，必须逐个 socket 单播，不能整房间广播同一份状态。
      io.to(player.socketId).emit(SERVER_EVENTS.GAME_UPDATED, toPublicGameState(room.gameState, player.playerId));
    }
  }
}

/**
 * @Description: 顺序执行房间服务返回的实时副作用，把业务结果转换成 join/leave/emit。
 *
 * @param params Socket server、当前 socket 和待执行副作用列表。
 * @return 执行过程产生的附加数据，例如大厅房间列表。
 *
 * @Date 2026-06-12 14:47
 */
export async function applyRoomRealtimeEffects(params: {
  io: Server;
  socket: Socket;
  effects: RoomRealtimeEffect[];
}): Promise<RoomRealtimeEffectResult> {
  const result: RoomRealtimeEffectResult = {};

  for (const effect of params.effects) {
    switch (effect.type) {
      case "join-lobby":
        await params.socket.join(LOBBY_WATCHERS_ROOM);
        break;
      case "leave-lobby":
        await params.socket.leave(LOBBY_WATCHERS_ROOM);
        break;
      case "join-room":
        await params.socket.join(effect.roomId);
        break;
      case "leave-room":
        await params.socket.leave(effect.roomId);
        break;
      case "emit-room-updated":
        await emitRoomUpdated(params.io, effect.roomId);
        break;
      case "emit-lobby-updated":
        result.lobbyRooms = await emitLobbyRoomsUpdated(params.io);
        break;
      case "emit-game-updated":
        await emitGameUpdated(params.io, effect.roomId);
        break;
      case "emit-game-event":
        params.io.to(effect.roomId).emit(SERVER_EVENTS.GAME_EVENT, effect.event);
        break;
      case "emit-game-challenge-resolved":
        params.io.to(effect.roomId).emit(SERVER_EVENTS.GAME_CHALLENGE_RESOLVED, effect.event);
        break;
      case "emit-game-finished":
        params.io.to(effect.roomId).emit(SERVER_EVENTS.GAME_FINISHED, {
          winnerPlayerId: effect.winnerPlayerId,
        });
        break;
    }
  }

  return result;
}
