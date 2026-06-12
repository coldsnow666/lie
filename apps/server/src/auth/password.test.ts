/**
 * @Description: 验证密码哈希升级后的兼容性和渐进迁移行为。
 *
 * @Date 2026-06-12 14:47
 */
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { env } from "../env";
import { hashPassword, verifyPassword } from "./password";

function legacyHashPassword(password: string) {
  const md5 = (value: string) => crypto.createHash("md5").update(value).digest("hex");
  const first = md5(password);
  return md5(`${first}${env.PASSWORD_HASH_SECRET}`);
}

describe("password hashing", () => {
  it("hashes new passwords with versioned scrypt output", async () => {
    const hash = await hashPassword("hunter2-password");

    expect(hash.startsWith("scrypt$")).toBe(true);
    await expect(verifyPassword("hunter2-password", hash)).resolves.toEqual({
      valid: true,
      needsRehash: false,
    });
  });

  it("accepts legacy md5 hashes and marks them for rehash", async () => {
    const legacyHash = legacyHashPassword("legacy-password");

    await expect(verifyPassword("legacy-password", legacyHash)).resolves.toEqual({
      valid: true,
      needsRehash: true,
    });
  });

  it("rejects invalid passwords", async () => {
    const hash = await hashPassword("correct-password");

    await expect(verifyPassword("wrong-password", hash)).resolves.toEqual({
      valid: false,
      needsRehash: false,
    });
  });
});
