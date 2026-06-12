/**
 * @Description: 房间 HTTP 路由：提供创建、加入和查询房间的 REST 入口。
 *
 * @Date 2026-06-12 14:47
 */
import { roomCreateSchema, roomJoinSchema, roomIdSchema } from "@lie/shared";
import { API_RESPONSE_CODE } from "@lie/shared";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/auth.middleware";
import { reportAppError, toApiErrorPayload } from "../utils/errors";
import { sendError, sendOk } from "../utils/response";
import { createRoom, joinRoom, leaveRoom, listPublicRooms, serializeRoom } from "./room.service";
import { getRoomById } from "./room.store";

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
      const room = await createRoom(request.user, parsed.data);
      return sendOk(reply, { room: serializeRoom(room) });
    } catch (error) {
      reportAppError("http.rooms.create", error, {
        userId: request.user.id,
        roomCode: parsed.data.roomCode ?? null,
      });
      return sendError(reply, toApiErrorPayload(error));
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
      reportAppError("http.rooms.join", error, {
        userId: request.user.id,
        roomCode: parsed.data.roomCode,
      });
      return sendError(reply, toApiErrorPayload(error));
    }
  });

  app.post("/rooms/:roomId/leave", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = roomIdSchema.safeParse(request.params);

    if (!parsed.success || !request.user) {
      return sendError(reply, { code: API_RESPONSE_CODE.ROOM_PARAMS_INVALID, message: "房间参数无效" });
    }

    try {
      const room = await leaveRoom(parsed.data.roomId, request.user);
      return sendOk(reply, { room: room ? serializeRoom(room) : null });
    } catch (error) {
      reportAppError("http.rooms.leave", error, {
        userId: request.user.id,
        roomId: parsed.data.roomId,
      });
      return sendError(reply, toApiErrorPayload(error));
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
