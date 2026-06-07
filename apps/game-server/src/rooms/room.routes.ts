/**
 * 房间 HTTP 路由：提供创建、加入和查询房间的 REST 入口。
 */
import type { FastifyInstance } from "fastify";
import { roomCreateSchema, roomJoinSchema, roomIdSchema } from "@lie/shared";
import { requireAuth } from "../auth/auth.middleware";
import { createRoom, joinRoom, serializeRoom } from "./room.service";
import { getRoomById } from "./room.store";

function routeError(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const messages: Record<string, string> = {
    ROOM_CODE_EXISTS: "房间码已存在",
    ROOM_NOT_FOUND: "房间不存在",
    ROOM_NOT_WAITING: "房间已开始",
    ROOM_FULL: "房间已满",
  };

  return {
    code,
    message: messages[code] ?? "房间请求失败",
  };
}

export async function roomRoutes(app: FastifyInstance) {
  app.post("/rooms", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = roomCreateSchema.safeParse(request.body ?? {});

    if (!parsed.success || !request.user) {
      return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "房间参数无效" } });
    }

    try {
      const room = await createRoom(request.user, parsed.data.roomCode);
      return { room: serializeRoom(room) };
    } catch (error) {
      return reply.code(400).send({ error: routeError(error) });
    }
  });

  app.post("/rooms/join", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = roomJoinSchema.safeParse(request.body);

    if (!parsed.success || !request.user) {
      return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "房间码无效" } });
    }

    try {
      const room = await joinRoom(parsed.data.roomCode, request.user);
      return { room: serializeRoom(room) };
    } catch (error) {
      return reply.code(400).send({ error: routeError(error) });
    }
  });

  app.get("/rooms/:roomId", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = roomIdSchema.safeParse(request.params);

    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "房间参数无效" } });
    }

    const room = await getRoomById(parsed.data.roomId);

    if (!room) {
      return reply.code(404).send({ error: { code: "ROOM_NOT_FOUND", message: "房间不存在" } });
    }

    return { room: serializeRoom(room) };
  });
}
