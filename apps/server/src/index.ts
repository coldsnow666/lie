/**
 * 游戏服务端入口：启动 Fastify HTTP 服务并挂载 Socket.IO。
 */
import { createApp } from "./app";
import { env } from "./env";
import { attachSocketServer } from "./socket";

const app = await createApp();
attachSocketServer(app.server);

await app.listen({
  port: env.GAME_SERVER_PORT,
  host: "0.0.0.0",
});
