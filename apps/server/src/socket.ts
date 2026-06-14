/**
 * @Description: Socket.IO 服务：处理实时房间与游戏事件，并按玩家视角广播脱敏状态。
 *
 * @Date 2026-06-12 14:47
 */
import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import {
  playCardsSchema,
  roomCreateSchema,
  roomIdSchema,
  roomJoinSchema,
  roomReadySchema,
  skipTurnSchema,
} from "@lie/shared";
import { verifyAccessToken, type AuthUser } from "./auth/token";
import { CLIENT_EVENTS } from "./events/client-events";
import {
  challengeRoomForSocket,
  createRoomForSocket,
  handleDisconnectForSocket,
  joinRoomForSocket,
  leaveRoomForSocket,
  playCardsForSocket,
  setReadyForSocket,
  skipTurnForSocket,
  startGameForSocket,
  subscribeLobbyForSocket,
  syncRoomForSocket,
  unsubscribeLobbyForSocket,
} from "./rooms/room.socket-service";
import { applyRoomRealtimeEffects } from "./rooms/room.realtime";
import { acquireLock, releaseLock } from "./redis/locks";
import { reportAppError, toSocketErrorPayload } from "./utils/errors";
import { errorContext, logger } from "./utils/logger";

type Ack<T = unknown> = (result: { ok: true; data: T } | { ok: false; error: { code: string; message: string } }) => void;

type AuthedSocket = Socket & {
  data: {
    user: AuthUser;
  };
};

const DISCONNECT_CLEANUP_DELAY_MS = 10_000;
const localRoomLocks = new Set<string>();

function ok<T>(ack: Ack<T> | undefined, data: T) {
  ack?.({ ok: true, data });
}

function fail(ack: Ack | undefined, error: unknown) {
  const payload = toSocketErrorPayload(error);

  ack?.({
    ok: false,
    error: payload,
  });
}

/**
 * @Description: 串行化同一房间内的关键游戏操作，先用进程内锁挡重入，再用 Redis 锁挡多实例并发。
 *
 * @param roomId 需要保护的房间 ID。
 * @param task 拿到锁后执行的房间业务操作。
 * @return task 的返回值。
 *
 * @Date 2026-06-12 14:47
 */
async function withRoomLock<T>(roomId: string, task: () => Promise<T>) {
  if (localRoomLocks.has(roomId)) {
    throw new Error("ROOM_BUSY");
  }

  localRoomLocks.add(roomId);
  const lockResult = await acquireLock(`room:${roomId}:lock`);
  try {
    if (lockResult.status === "busy") {
      throw new Error("ROOM_BUSY");
    }

    if (lockResult.status === "unavailable") {
      throw new Error("REDIS_UNAVAILABLE");
    }

    return await task();
  } finally {
    localRoomLocks.delete(roomId);

    if (lockResult.status === "acquired") {
      await releaseLock(lockResult.lock);
    }
  }
}

/**
 * @Description: 挂载 Socket.IO 服务，统一鉴权、ack 响应和房间实时事件编排。
 *
 * @param httpServer Fastify 底层 HTTP server。
 * @return 已挂载的 Socket.IO server。
 *
 * @Date 2026-06-12 14:47
 */
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
      logger.warn("socket authentication failed", {
        scope: "socket.connection.auth",
        socketId: socket.id,
      });
      return next(new Error("UNAUTHORIZED"));
    }

    socket.data.user = user;
    // 后续所有游戏操作都从 socket.data.user 取用户身份，不信任客户端传 userId。
    next();
  });

  io.on("connection", (socket: Socket) => {
    const authedSocket = socket as AuthedSocket;

    authedSocket.on(CLIENT_EVENTS.LOBBY_SUBSCRIBE, async (_payload, ack?: Ack) => {
      try {
        const result = subscribeLobbyForSocket();
        const effectResult = await applyRoomRealtimeEffects({
          io,
          socket: authedSocket,
          effects: result.effects,
        });
        ok(ack, { rooms: effectResult.lobbyRooms ?? [] });
      } catch (error) {
        reportAppError("socket.lobby.subscribe", error, {
          socketId: authedSocket.id,
          userId: authedSocket.data.user.id,
        });
        fail(ack, error);
      }
    });

    authedSocket.on(CLIENT_EVENTS.LOBBY_UNSUBSCRIBE, async (_payload, ack?: Ack) => {
      try {
        const result = unsubscribeLobbyForSocket();
        await applyRoomRealtimeEffects({
          io,
          socket: authedSocket,
          effects: result.effects,
        });
        ok(ack, result.data);
      } catch (error) {
        reportAppError("socket.lobby.unsubscribe", error, {
          socketId: authedSocket.id,
          userId: authedSocket.data.user.id,
        });
        fail(ack, error);
      }
    });

    authedSocket.on(CLIENT_EVENTS.ROOM_CREATE, async (payload, ack?: Ack) => {
      const parsed = roomCreateSchema.safeParse(payload ?? {});
      if (!parsed.success) {
        return fail(ack, new Error("VALIDATION_ERROR"));
      }

      try {
        const result = await createRoomForSocket(authedSocket.data.user, parsed.data, authedSocket.id);
        await applyRoomRealtimeEffects({
          io,
          socket: authedSocket,
          effects: result.effects,
        });
        ok(ack, result.data);
      } catch (error) {
        reportAppError("socket.room.create", error, {
          socketId: authedSocket.id,
          userId: authedSocket.data.user.id,
          roomCode: parsed.data.roomCode ?? null,
        });
        fail(ack, error);
      }
    });

    authedSocket.on(CLIENT_EVENTS.ROOM_JOIN, async (payload, ack?: Ack) => {
      const parsed = roomJoinSchema.safeParse(payload);
      if (!parsed.success) {
        return fail(ack, new Error("VALIDATION_ERROR"));
      }

      try {
        const result = await joinRoomForSocket(parsed.data.roomCode, authedSocket.data.user, authedSocket.id);
        await applyRoomRealtimeEffects({
          io,
          socket: authedSocket,
          effects: result.effects,
        });
        ok(ack, result.data);
      } catch (error) {
        reportAppError("socket.room.join", error, {
          socketId: authedSocket.id,
          userId: authedSocket.data.user.id,
          roomCode: parsed.data.roomCode,
        });
        fail(ack, error);
      }
    });

    authedSocket.on(CLIENT_EVENTS.ROOM_LEAVE, async (payload, ack?: Ack) => {
      const parsed = roomIdSchema.safeParse(payload);
      if (!parsed.success) {
        return fail(ack, new Error("VALIDATION_ERROR"));
      }

      try {
        const result = await leaveRoomForSocket(parsed.data.roomId, authedSocket.data.user);
        await applyRoomRealtimeEffects({
          io,
          socket: authedSocket,
          effects: result.effects,
        });
        ok(ack, result.data);
      } catch (error) {
        reportAppError("socket.room.leave", error, {
          socketId: authedSocket.id,
          userId: authedSocket.data.user.id,
          roomId: parsed.data.roomId,
        });
        fail(ack, error);
      }
    });

    authedSocket.on(CLIENT_EVENTS.ROOM_READY, async (payload, ack?: Ack) => {
      const parsed = roomReadySchema.safeParse(payload);
      if (!parsed.success) {
        return fail(ack, new Error("VALIDATION_ERROR"));
      }

      try {
        const result = await setReadyForSocket(parsed.data.roomId, authedSocket.data.user, parsed.data.ready);
        await applyRoomRealtimeEffects({
          io,
          socket: authedSocket,
          effects: result.effects,
        });
        ok(ack, result.data);
      } catch (error) {
        reportAppError("socket.room.ready", error, {
          socketId: authedSocket.id,
          userId: authedSocket.data.user.id,
          roomId: parsed.data.roomId,
          ready: parsed.data.ready,
        });
        fail(ack, error);
      }
    });

    authedSocket.on(CLIENT_EVENTS.GAME_START, async (payload, ack?: Ack) => {
      const parsed = roomIdSchema.safeParse(payload);
      if (!parsed.success) {
        return fail(ack, new Error("VALIDATION_ERROR"));
      }

      try {
        const result = await withRoomLock(parsed.data.roomId, () => startGameForSocket(parsed.data.roomId, authedSocket.data.user));
        await applyRoomRealtimeEffects({
          io,
          socket: authedSocket,
          effects: result.effects,
        });
        ok(ack, result.data);
      } catch (error) {
        reportAppError("socket.game.start", error, {
          socketId: authedSocket.id,
          userId: authedSocket.data.user.id,
          roomId: parsed.data.roomId,
        });
        fail(ack, error);
      }
    });

    authedSocket.on(CLIENT_EVENTS.GAME_PLAY_CARDS, async (payload, ack?: Ack) => {
      const parsed = playCardsSchema.safeParse(payload);
      if (!parsed.success) {
        return fail(ack, new Error("VALIDATION_ERROR"));
      }

      try {
        const result = await withRoomLock(parsed.data.roomId, () =>
          playCardsForSocket(parsed.data.roomId, authedSocket.data.user, parsed.data.cardIds, parsed.data.declaredRank),
        );
        await applyRoomRealtimeEffects({
          io,
          socket: authedSocket,
          effects: result.effects,
        });
        ok(ack, result.data);
      } catch (error) {
        reportAppError("socket.game.playCards", error, {
          socketId: authedSocket.id,
          userId: authedSocket.data.user.id,
          roomId: parsed.data.roomId,
          cardCount: parsed.data.cardIds.length,
          declaredRank: parsed.data.declaredRank ?? null,
        });
        fail(ack, error);
      }
    });

    authedSocket.on(CLIENT_EVENTS.GAME_SKIP_TURN, async (payload, ack?: Ack) => {
      const parsed = skipTurnSchema.safeParse(payload);
      if (!parsed.success) {
        return fail(ack, new Error("VALIDATION_ERROR"));
      }

      try {
        const result = await withRoomLock(parsed.data.roomId, () =>
          skipTurnForSocket(parsed.data.roomId, authedSocket.data.user),
        );
        await applyRoomRealtimeEffects({
          io,
          socket: authedSocket,
          effects: result.effects,
        });
        ok(ack, result.data);
      } catch (error) {
        reportAppError("socket.game.skipTurn", error, {
          socketId: authedSocket.id,
          userId: authedSocket.data.user.id,
          roomId: parsed.data.roomId,
        });
        fail(ack, error);
      }
    });

    authedSocket.on(CLIENT_EVENTS.GAME_CHALLENGE, async (payload, ack?: Ack) => {
      const parsed = roomIdSchema.safeParse(payload);
      if (!parsed.success) {
        return fail(ack, new Error("VALIDATION_ERROR"));
      }

      try {
        const result = await withRoomLock(parsed.data.roomId, () =>
          challengeRoomForSocket(parsed.data.roomId, authedSocket.data.user),
        );
        await applyRoomRealtimeEffects({
          io,
          socket: authedSocket,
          effects: result.effects,
        });
        ok(ack, result.data);
      } catch (error) {
        reportAppError("socket.game.challenge", error, {
          socketId: authedSocket.id,
          userId: authedSocket.data.user.id,
          roomId: parsed.data.roomId,
        });
        fail(ack, error);
      }
    });

    authedSocket.on(CLIENT_EVENTS.GAME_SYNC, async (payload, ack?: Ack) => {
      const parsed = roomIdSchema.safeParse(payload);
      if (!parsed.success) {
        return fail(ack, new Error("VALIDATION_ERROR"));
      }

      try {
        const result = await syncRoomForSocket(parsed.data.roomId, authedSocket.data.user, authedSocket.id);
        await applyRoomRealtimeEffects({
          io,
          socket: authedSocket,
          effects: result.effects,
        });
        ok(ack, result.data);
      } catch (error) {
        reportAppError("socket.game.sync", error, {
          socketId: authedSocket.id,
          userId: authedSocket.data.user.id,
          roomId: parsed.data.roomId,
        });
        fail(ack, error);
      }
    });

    authedSocket.on("disconnect", () => {
      const disconnectedSocketId = authedSocket.id;

      setTimeout(() => {
        void handleDisconnectForSocket(disconnectedSocketId)
          .then(async (result) => {
            await applyRoomRealtimeEffects({
              io,
              socket: authedSocket,
              effects: result.effects,
            });
          })
          .catch((error) => {
            logger.error("socket disconnect cleanup failed", {
              scope: "socket.disconnect.cleanup",
              socketId: disconnectedSocketId,
              ...errorContext(error),
            });
          });
      }, DISCONNECT_CLEANUP_DELAY_MS);
    });
  });

  return io;
}
