/**
 * 房间 HTTP 路由：提供创建、加入和查询房间的 REST 入口。
 */
import type { FastifyInstance } from "fastify";
import { roomCreateSchema, roomJoinSchema, roomIdSchema } from "@lie/shared";
import { requireAuth } from "../auth/auth.middleware";
import { sendError, sendOk, type ApiErrorPayload } from "../utils/response";
import { createRoom, joinRoom, serializeRoom } from "./room.service";
import { getRoomById } from "./room.store";

function routeError(error: unknown): ApiErrorPayload {
  const rawCode = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const errors: Record<string, ApiErrorPayload> = {
    ROOM_CODE_EXISTS: {
      code: 40911,
      message: "房间码已存在",
    },
    ROOM_NOT_FOUND: {
      code: 40411,
      message: "房间不存在",
    },
    ROOM_NOT_WAITING: {
      code: 40912,
      message: "房间已开始",
    },
    ROOM_FULL: {
      code: 40913,
      message: "房间已满",
    },
    UNKNOWN_ERROR: {
      code: 50000,
      message: "房间请求失败",
    },
  };
  return errors[rawCode] ?? errors.UNKNOWN_ERROR;
}

export async function roomRoutes(app: FastifyInstance) {
  app.post("/rooms", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = roomCreateSchema.safeParse(request.body ?? {});

    if (!parsed.success || !request.user) {
      return sendError(reply, { code: 40010, message: "房间参数无效" });
    }

    try {
      const room = await createRoom(request.user, parsed.data.roomCode);
      return sendOk(reply, { room: serializeRoom(room) });
    } catch (error) {
      return sendError(reply, routeError(error));
    }
  });

  app.post("/rooms/join", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = roomJoinSchema.safeParse(request.body);

    if (!parsed.success || !request.user) {
      return sendError(reply, { code: 40011, message: "房间码无效" });
    }

    try {
      const room = await joinRoom(parsed.data.roomCode, request.user);
      return sendOk(reply, { room: serializeRoom(room) });
    } catch (error) {
      return sendError(reply, routeError(error));
    }
  });

  app.get("/rooms/:roomId", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = roomIdSchema.safeParse(request.params);

    if (!parsed.success) {
      return sendError(reply, { code: 40010, message: "房间参数无效" });
    }

    const room = await getRoomById(parsed.data.roomId);

    if (!room) {
      return sendError(reply, { code: 40411, message: "房间不存在" });
    }

    return sendOk(reply, { room: serializeRoom(room) });
  });
}
