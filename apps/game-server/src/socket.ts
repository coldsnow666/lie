/**
 * Socket.IO 服务：处理实时房间与游戏事件，并按玩家视角广播脱敏状态。
 */
import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import {
  playCardsSchema,
  roomCreateSchema,
  roomIdSchema,
  roomJoinSchema,
  roomReadySchema,
  toPublicGameState,
  type PublicGameEvent,
} from "@lie/shared";
import { verifyAccessToken, type AuthUser } from "./auth/token";
import { CLIENT_EVENTS } from "./events/client-events";
import { SERVER_EVENTS } from "./events/server-events";
import {
  challengeRoomLastPlay,
  createRoom,
  joinRoom,
  leaveRoom,
  playRoomCards,
  serializeRoom,
  setReady,
  startGame,
} from "./rooms/room.service";
import { getRoomById } from "./rooms/room.store";
import { acquireLock, releaseLock } from "./redis/locks";

type Ack<T = unknown> = (result: { ok: true; data: T } | { ok: false; error: { code: string; message: string } }) => void;

type AuthedSocket = Socket & {
  data: {
    user: AuthUser;
  };
};

function ok<T>(ack: Ack<T> | undefined, data: T) {
  ack?.({ ok: true, data });
}

function fail(ack: Ack | undefined, error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const messages: Record<string, string> = {
    UNAUTHORIZED: "请先登录",
    ROOM_CODE_EXISTS: "房间码已存在",
    ROOM_NOT_FOUND: "房间不存在",
    ROOM_NOT_WAITING: "房间已开始",
    ROOM_FULL: "房间已满",
    PLAYER_NOT_IN_ROOM: "你不在这个房间",
    ONLY_OWNER_CAN_START: "只有房主可以开始游戏",
    INVALID_PLAYER_COUNT: "需要 2 到 6 名玩家才能开始",
    GAME_NOT_FOUND: "对局不存在",
    GAME_NOT_PLAYING: "对局未进行中",
    NOT_YOUR_TURN: "还没轮到你",
    INVALID_CARD_COUNT: "请选择 1 到 4 张牌",
    DUPLICATE_CARD_IDS: "不能重复选择同一张牌",
    CARD_NOT_IN_HAND: "选择的牌不在你的手牌中",
    NO_LAST_PLAY: "当前没有可质疑的上一手",
    CANNOT_CHALLENGE_SELF: "不能质疑自己刚打出的牌",
  };

  ack?.({
    ok: false,
    error: {
      code,
      message: messages[code] ?? "操作失败",
    },
  });
}

async function emitRoomUpdated(io: Server, roomId: string) {
  const room = await getRoomById(roomId);
  if (!room) {
    return;
  }

  io.to(room.id).emit(SERVER_EVENTS.ROOM_UPDATED, serializeRoom(room));
}

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

async function emitGameEvent(io: Server, roomId: string, event: PublicGameEvent) {
  io.to(roomId).emit(SERVER_EVENTS.GAME_EVENT, event);
}

async function withRoomLock<T>(roomId: string, task: () => Promise<T>) {
  const lock = await acquireLock(`room:${roomId}:lock`);
  try {
    // Redis 不可用时 lock 为 null，本地单进程仍可继续；多实例部署必须确保 Redis 可用。
    return await task();
  } finally {
    if (lock) {
      await releaseLock(lock);
    }
  }
}

export function attachSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const user = verifyAccessToken(typeof token === "string" ? token : null);

    if (!user) {
      return next(new Error("UNAUTHORIZED"));
    }

    socket.data.user = user;
    // 后续所有游戏操作都从 socket.data.user 取用户身份，不信任客户端传 userId。
    next();
  });

  io.on("connection", (socket: Socket) => {
    const authedSocket = socket as AuthedSocket;

    authedSocket.on(CLIENT_EVENTS.ROOM_CREATE, async (payload, ack?: Ack) => {
      const parsed = roomCreateSchema.safeParse(payload ?? {});
      if (!parsed.success) {
        return fail(ack, new Error("VALIDATION_ERROR"));
      }

      try {
        const room = await createRoom(authedSocket.data.user, parsed.data.roomCode, authedSocket.id);
        await authedSocket.join(room.id);
        await emitRoomUpdated(io, room.id);
        ok(ack, { room: serializeRoom(room) });
      } catch (error) {
        fail(ack, error);
      }
    });

    authedSocket.on(CLIENT_EVENTS.ROOM_JOIN, async (payload, ack?: Ack) => {
      const parsed = roomJoinSchema.safeParse(payload);
      if (!parsed.success) {
        return fail(ack, new Error("VALIDATION_ERROR"));
      }

      try {
        const room = await joinRoom(parsed.data.roomCode, authedSocket.data.user, authedSocket.id);
        await authedSocket.join(room.id);
        await emitRoomUpdated(io, room.id);
        ok(ack, { room: serializeRoom(room) });
      } catch (error) {
        fail(ack, error);
      }
    });

    authedSocket.on(CLIENT_EVENTS.ROOM_LEAVE, async (payload, ack?: Ack) => {
      const parsed = roomIdSchema.safeParse(payload);
      if (!parsed.success) {
        return fail(ack, new Error("VALIDATION_ERROR"));
      }

      try {
        const room = await leaveRoom(parsed.data.roomId, authedSocket.data.user);
        await authedSocket.leave(parsed.data.roomId);
        if (room) {
          await emitRoomUpdated(io, room.id);
        }
        ok(ack, { room: room ? serializeRoom(room) : null });
      } catch (error) {
        fail(ack, error);
      }
    });

    authedSocket.on(CLIENT_EVENTS.ROOM_READY, async (payload, ack?: Ack) => {
      const parsed = roomReadySchema.safeParse(payload);
      if (!parsed.success) {
        return fail(ack, new Error("VALIDATION_ERROR"));
      }

      try {
        const room = await setReady(parsed.data.roomId, authedSocket.data.user, parsed.data.ready);
        await emitRoomUpdated(io, room.id);
        ok(ack, { room: serializeRoom(room) });
      } catch (error) {
        fail(ack, error);
      }
    });

    authedSocket.on(CLIENT_EVENTS.GAME_START, async (payload, ack?: Ack) => {
      const parsed = roomIdSchema.safeParse(payload);
      if (!parsed.success) {
        return fail(ack, new Error("VALIDATION_ERROR"));
      }

      try {
        const room = await withRoomLock(parsed.data.roomId, () => startGame(parsed.data.roomId, authedSocket.data.user));
        await emitRoomUpdated(io, room.id);
        await emitGameUpdated(io, room.id);
        ok(ack, { room: serializeRoom(room) });
      } catch (error) {
        fail(ack, error);
      }
    });

    authedSocket.on(CLIENT_EVENTS.GAME_PLAY_CARDS, async (payload, ack?: Ack) => {
      const parsed = playCardsSchema.safeParse(payload);
      if (!parsed.success) {
        return fail(ack, new Error("VALIDATION_ERROR"));
      }

      try {
        const { room, event } = await withRoomLock(parsed.data.roomId, () =>
          playRoomCards(parsed.data.roomId, authedSocket.data.user, parsed.data.cardIds),
        );
        await emitGameUpdated(io, room.id);
        await emitGameEvent(io, room.id, event);

        if (room.gameState?.winnerPlayerId) {
          io.to(room.id).emit(SERVER_EVENTS.GAME_FINISHED, {
            winnerPlayerId: room.gameState.winnerPlayerId,
          });
        }

        ok(ack, { event });
      } catch (error) {
        fail(ack, error);
      }
    });

    authedSocket.on(CLIENT_EVENTS.GAME_CHALLENGE, async (payload, ack?: Ack) => {
      const parsed = roomIdSchema.safeParse(payload);
      if (!parsed.success) {
        return fail(ack, new Error("VALIDATION_ERROR"));
      }

      try {
        const { room, event } = await withRoomLock(parsed.data.roomId, () =>
          challengeRoomLastPlay(parsed.data.roomId, authedSocket.data.user),
        );
        await emitGameUpdated(io, room.id);
        await emitGameEvent(io, room.id, event);
        io.to(room.id).emit(SERVER_EVENTS.GAME_CHALLENGE_RESOLVED, event);
        ok(ack, { event });
      } catch (error) {
        fail(ack, error);
      }
    });

    authedSocket.on(CLIENT_EVENTS.GAME_SYNC, async (payload, ack?: Ack) => {
      const parsed = roomIdSchema.safeParse(payload);
      if (!parsed.success) {
        return fail(ack, new Error("VALIDATION_ERROR"));
      }

      try {
        const room = await getRoomById(parsed.data.roomId);
        if (!room) {
          throw new Error("ROOM_NOT_FOUND");
        }

        await authedSocket.join(room.id);
        await emitRoomUpdated(io, room.id);
        await emitGameUpdated(io, room.id);
        ok(ack, { room: serializeRoom(room) });
      } catch (error) {
        fail(ack, error);
      }
    });
  });

  return io;
}
