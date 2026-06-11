/**
 * Redis 短锁工具：用于保护同一房间内的并发游戏操作。
 */
import crypto from "node:crypto";
import { errorContext, logger } from "../utils/logger";
import { getRedis, tryRedis } from "./client";

export type RedisLock = {
  key: string;
  token: string;
};

export type AcquireLockResult =
  | { status: "acquired"; lock: RedisLock }
  | { status: "busy" }
  | { status: "unavailable" };

export async function acquireLock(key: string, ttlMs = 3000): Promise<AcquireLockResult> {
  try {
    const client = getRedis();
    if (client.status === "wait") {
      await client.connect();
    }

    const token = crypto.randomUUID();
    const result = await client.set(key, token, "PX", ttlMs, "NX");

    return result === "OK" ? { status: "acquired", lock: { key, token } } : { status: "busy" };
  } catch (error) {
    logger.warn("redis lock unavailable", {
      scope: "redis.lock.acquire",
      key,
      ttlMs,
      ...errorContext(error),
    });
    return { status: "unavailable" };
  }
}

export async function releaseLock(lock: RedisLock) {
  // 只释放自己持有的锁，避免误删其他并发请求刚抢到的新锁。
  await tryRedis(
    (client) =>
      client.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        lock.key,
        lock.token,
      ),
    "redis.lock.release",
  );
}
