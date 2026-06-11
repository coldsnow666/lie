/**
 * Fastify 应用工厂：注册 CORS、健康检查、认证路由和房间路由。
 */
import cors from "@fastify/cors";
import Fastify from "fastify";
import { closePrisma } from "./db/prisma";
import { closeRedis } from "./redis/client";
import { authRoutes } from "./auth/auth.routes";
import { roomRoutes } from "./rooms/room.routes";
import { reportAppError, toApiErrorPayload } from "./utils/errors";
import { logger } from "./utils/logger";
import { sendError } from "./utils/response";
import { sendOk } from "./utils/response";

export async function createApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  app.setErrorHandler((error, request, reply) => {
    reportAppError("http.unhandled", error, {
      method: request.method,
      url: request.url,
    });
    return sendError(reply, toApiErrorPayload(error));
  });

  app.addHook("onClose", async () => {
    logger.info("closing server resources", {
      scope: "app.close",
    });
    await closePrisma();
    await closeRedis();
  });

  app.get("/health", async (_request, reply) => sendOk(reply, { service: "lie-server" }));

  await app.register(authRoutes);
  await app.register(roomRoutes);

  return app;
}
