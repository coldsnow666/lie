/**
 * Redis 客户端：提供可失败的 Redis 调用封装，保留本地内存兜底能力。
 */
import Redis from "ioredis";
import { env } from "../env";

let redis: Redis | null = null;

export function getRedis() {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    redis.on("error", () => {
      // Redis 未启动时保持静默，房间热状态会继续使用内存存储。
    });
  }

  return redis;
}

export async function tryRedis<T>(operation: (client: Redis) => Promise<T>) {
  // Redis 在 MVP 本地开发中不是硬依赖，连接失败时让调用方继续走内存状态。
  try {
    const client = getRedis();
    if (client.status === "wait") {
      await client.connect();
    }
    return await operation(client);
  } catch {
    return null;
  }
}
