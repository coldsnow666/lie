/**
 * Fastify 应用工厂：注册 CORS、健康检查、认证路由和房间路由。
 */
import cors from "@fastify/cors";
import Fastify from "fastify";
import { authRoutes } from "./auth/auth.routes";
import { roomRoutes } from "./rooms/room.routes";

export async function createApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  app.get("/health", async () => ({
    ok: true,
    service: "lie-game-server",
  }));

  await app.register(authRoutes);
  await app.register(roomRoutes);

  return app;
}
