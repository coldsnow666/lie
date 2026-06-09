/**
 * 密码哈希工具：按 MVP 要求使用两次 MD5，并支持额外 secret。
 */
import crypto from "node:crypto";

function md5(value: string) {
  return crypto.createHash("md5").update(value).digest("hex");
}

export function hashPassword(password: string) {
  const first = md5(password);
  return md5(`${first}${process.env.PASSWORD_HASH_SECRET || ""}`);
}

export function verifyPassword(password: string, passwordHash: string) {
  return hashPassword(password) === passwordHash;
}
