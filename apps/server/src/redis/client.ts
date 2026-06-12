/**
 * @Description: 统一管理服务端 Redis 连接、健康检查和不可用错误。
 *
 * @Date 2026-06-12 14:47
 */
import Redis from "ioredis";
import { env } from "../env";
import { AppError } from "../utils/errors";
import { errorContext, logger } from "../utils/logger";

let redis: Redis | null = null;

function createRedisUnavailableError() {
  return new AppError("REDIS_UNAVAILABLE");
}

async function connectRedisClient(client: Redis) {
  if (client.status === "wait") {
    await client.connect();
  }

  return client;
}

export function getRedis() {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    redis.on("error", (error) => {
      logger.warn("redis client error", {
        scope: "redis.client",
        status: redis?.status ?? "unknown",
        ...errorContext(error),
      });
    });
  }

  return redis;
}

export async function tryRedis<T>(operation: (client: Redis) => Promise<T>, operationName = "unknown") {
  try {
    const client = await connectRedisClient(getRedis());
    return await operation(client);
  } catch (error) {
    logger.warn("redis operation failed", {
      scope: "redis.try",
      operationName,
      ...errorContext(error),
    });

    throw createRedisUnavailableError();
  }
}

export async function ensureRedisAvailable() {
  try {
    await connectRedisClient(getRedis());
    return true;
  } catch (error) {
    logger.error("redis startup check failed", {
      scope: "redis.startup",
      ...errorContext(error),
    });

    throw createRedisUnavailableError();
  }
}

export async function closeRedis() {
  if (!redis) {
    return;
  }

  if (redis.status === "end") {
    redis = null;
    return;
  }

  try {
    if (redis.status === "wait") {
      redis.disconnect();
    } else {
      await redis.quit();
    }
  } finally {
    redis = null;
  }
}
