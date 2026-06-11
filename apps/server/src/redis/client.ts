/**
 * Redis 客户端：生产环境强依赖 Redis；开发和测试环境允许调用方回退到进程内缓存。
 */
import Redis from "ioredis";
import { env } from "../env";
import { AppError } from "../utils/errors";
import { errorContext, logger } from "../utils/logger";

let redis: Redis | null = null;

export type RedisAttemptResult<T> =
  | {
      available: true;
      value: T;
    }
  | {
    available: false;
    };

export function isRedisRequired() {
  return env.NODE_ENV === "production";
}

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
        redisRequired: isRedisRequired(),
        status: redis?.status ?? "unknown",
        ...errorContext(error),
      });
    });
  }

  return redis;
}

export async function tryRedis<T>(operation: (client: Redis) => Promise<T>, operationName = "unknown") {
  // 生产环境必须依赖 Redis；开发和测试环境才允许调用方继续走内存回退路径。
  try {
    const client = await connectRedisClient(getRedis());
    return await operation(client);
  } catch (error) {
    logger.warn("redis operation failed", {
      scope: "redis.try",
      operationName,
      redisRequired: isRedisRequired(),
      ...errorContext(error),
    });

    if (isRedisRequired()) {
      throw createRedisUnavailableError();
    }

    return null;
  }
}

export async function tryRedisResult<T>(
  operation: (client: Redis) => Promise<T>,
  operationName = "unknown",
): Promise<RedisAttemptResult<T>> {
  try {
    const client = await connectRedisClient(getRedis());

    return {
      available: true,
      value: await operation(client),
    };
  } catch (error) {
    logger.warn("redis operation failed", {
      scope: "redis.try",
      operationName,
      redisRequired: isRedisRequired(),
      ...errorContext(error),
    });

    if (isRedisRequired()) {
      throw createRedisUnavailableError();
    }

    return {
      available: false,
    };
  }
}

export async function ensureRedisAvailable() {
  try {
    await connectRedisClient(getRedis());
    return true;
  } catch (error) {
    logger.error("redis startup check failed", {
      scope: "redis.startup",
      redisRequired: isRedisRequired(),
      ...errorContext(error),
    });

    if (isRedisRequired()) {
      throw createRedisUnavailableError();
    }

    return false;
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
