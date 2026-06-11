/**
 * 游戏服务端入口：启动 Fastify HTTP 服务并挂载 Socket.IO。
 */
import { errorContext, logger } from "./utils/logger";
import { createApp } from "./app";
import { env } from "./env";
import { ensureRedisAvailable, isRedisRequired } from "./redis/client";
import { attachSocketServer } from "./socket";

if (isRedisRequired()) {
  await ensureRedisAvailable();
}

const app = await createApp();
const io = attachSocketServer(app.server);

app.addHook("onClose", async () => {
  await new Promise<void>((resolve, reject) => {
    io.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

let shutdownPromise: Promise<void> | null = null;

async function shutdown(signal: string) {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  shutdownPromise = (async () => {
    logger.info("shutdown requested", {
      scope: "server.shutdown",
      signal,
    });
    await app.close();
    logger.info("shutdown completed", {
      scope: "server.shutdown",
      signal,
    });
  })().catch((error) => {
    logger.error("shutdown failed", {
      scope: "server.shutdown",
      signal,
      ...errorContext(error),
    });
    throw error;
  });

  return shutdownPromise;
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdown(signal)
      .then(() => {
        process.exit(0);
      })
      .catch(() => {
        process.exit(1);
      });
  });
}

process.on("unhandledRejection", (reason) => {
  logger.error("unhandled promise rejection", {
    scope: "process.unhandledRejection",
    ...errorContext(reason),
  });
});

process.on("uncaughtException", (error) => {
  logger.error("uncaught exception", {
    scope: "process.uncaughtException",
    ...errorContext(error),
  });
  void shutdown("uncaughtException")
    .then(() => {
      process.exit(1);
    })
    .catch(() => {
      process.exit(1);
    });
});

await app.listen({
  port: env.GAME_SERVER_PORT,
  host: "0.0.0.0",
});

logger.info("server listening", {
  scope: "server.start",
  port: env.GAME_SERVER_PORT,
});
