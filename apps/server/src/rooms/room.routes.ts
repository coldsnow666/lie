/**
 * 房间 HTTP 路由：提供创建、加入和查询房间的 REST 入口。
 */
import { roomCreateSchema, roomJoinSchema, roomIdSchema } from "@lie/shared";
import { API_RESPONSE_CODE } from "@lie/shared";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/auth.middleware";
import { sendError, sendOk, type ApiErrorPayload } from "../utils/response";
import { createRoom, joinRoom, listPublicRooms, serializeRoom } from "./room.service";
import { getRoomById } from "./room.store";

function routeError(error: unknown): ApiErrorPayload {
  const rawCode = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const errors: Record<string, ApiErrorPayload> = {
    ROOM_CODE_EXISTS: {
      code: API_RESPONSE_CODE.ROOM_CODE_EXISTS,
      message: "房间码已存在",
    },
    ROOM_NOT_FOUND: {
      code: API_RESPONSE_CODE.ROOM_NOT_FOUND,
      message: "房间不存在",
    },
    ROOM_NOT_WAITING: {
      code: API_RESPONSE_CODE.ROOM_NOT_WAITING,
      message: "房间已开始",
    },
    ROOM_FULL: {
      code: API_RESPONSE_CODE.ROOM_FULL,
      message: "房间已满",
    },
    UNKNOWN_ERROR: {
      code: API_RESPONSE_CODE.UNKNOWN_ERROR,
      message: "房间请求失败",
    },
  };
  return errors[rawCode] ?? errors.UNKNOWN_ERROR;
}

export async function roomRoutes(app: FastifyInstance) {
  app.get("/rooms", { preHandler: requireAuth }, async (_request, reply) => {
    const rooms = await listPublicRooms();
    return sendOk(reply, { rooms });
  });

  app.post("/rooms", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = roomCreateSchema.safeParse(request.body ?? {});

    if (!parsed.success || !request.user) {
      return sendError(reply, { code: API_RESPONSE_CODE.ROOM_PARAMS_INVALID, message: "房间参数无效" });
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
      return sendError(reply, { code: API_RESPONSE_CODE.ROOM_CODE_INVALID, message: "房间码无效" });
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
      return sendError(reply, { code: API_RESPONSE_CODE.ROOM_PARAMS_INVALID, message: "房间参数无效" });
    }

    const room = await getRoomById(parsed.data.roomId);

    if (!room) {
      return sendError(reply, { code: API_RESPONSE_CODE.ROOM_NOT_FOUND, message: "房间不存在" });
    }

    return sendOk(reply, { room: serializeRoom(room) });
  });
}
