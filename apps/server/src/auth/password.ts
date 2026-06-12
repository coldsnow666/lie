/**
 * @Description: 密码哈希工具：默认使用带盐 scrypt，并兼容旧版双 MD5 哈希的渐进迁移。
 *
 * @Date 2026-06-12 14:47
 */
import crypto from "node:crypto";
import { env } from "../env";

const PASSWORD_HASH_PREFIX = "scrypt";
const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export type PasswordVerificationResult = {
  valid: boolean;
  needsRehash: boolean;
};

function md5(value: string) {
  return crypto.createHash("md5").update(value).digest("hex");
}

function normalizePasswordInput(password: string) {
  return `${password}\u001f${env.PASSWORD_HASH_SECRET}`;
}

function hashLegacyPassword(password: string) {
  const first = md5(password);
  return md5(`${first}${env.PASSWORD_HASH_SECRET}`);
}

async function deriveScryptKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      normalizePasswordInput(password),
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELIZATION,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey as Buffer);
      },
    );
  });
}

function parseScryptHash(passwordHash: string) {
  const [prefix, cost, blockSize, parallelization, saltHex, keyHex] = passwordHash.split("$");
  if (
    prefix !== PASSWORD_HASH_PREFIX ||
    !cost ||
    !blockSize ||
    !parallelization ||
    !saltHex ||
    !keyHex
  ) {
    return null;
  }

  const parsedCost = Number.parseInt(cost, 10);
  const parsedBlockSize = Number.parseInt(blockSize, 10);
  const parsedParallelization = Number.parseInt(parallelization, 10);

  if (
    !Number.isSafeInteger(parsedCost) ||
    !Number.isSafeInteger(parsedBlockSize) ||
    !Number.isSafeInteger(parsedParallelization)
  ) {
    return null;
  }

  try {
    return {
      cost: parsedCost,
      blockSize: parsedBlockSize,
      parallelization: parsedParallelization,
      salt: Buffer.from(saltHex, "hex"),
      key: Buffer.from(keyHex, "hex"),
    };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = await deriveScryptKey(password, salt);

  return [
    PASSWORD_HASH_PREFIX,
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt.toString("hex"),
    key.toString("hex"),
  ].join("$");
}

export async function verifyPassword(password: string, passwordHash: string): Promise<PasswordVerificationResult> {
  const parsed = parseScryptHash(passwordHash);

  if (parsed) {
    const key = await deriveScryptKey(password, parsed.salt);
    const valid = key.length === parsed.key.length && crypto.timingSafeEqual(key, parsed.key);

    return {
      valid,
      needsRehash:
        valid &&
        (parsed.cost !== SCRYPT_COST ||
          parsed.blockSize !== SCRYPT_BLOCK_SIZE ||
          parsed.parallelization !== SCRYPT_PARALLELIZATION),
    };
  }

  const validLegacyPassword = hashLegacyPassword(password) === passwordHash;

  return {
    valid: validLegacyPassword,
    needsRehash: validLegacyPassword,
  };
}
