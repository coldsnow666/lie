/**
 * @Description: 统一维护服务端领域错误、基础设施错误和 HTTP/Socket 的错误序列化规则。
 *
 * @Date 2026-06-12 14:47
 */
import { API_RESPONSE_CODE, type ApiResponseCode } from "@lie/shared";
import type { ApiErrorPayload } from "./response";
import { errorContext, logger } from "./logger";

type AppErrorCode =
  | "UNKNOWN_ERROR"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "AUTH_EXPIRED"
  | "EMAIL_ALREADY_REGISTERED"
  | "NICKNAME_ALREADY_REGISTERED"
  | "INVALID_EMAIL_OR_PASSWORD"
  | "ROOM_CODE_EXISTS"
  | "ROOM_NOT_FOUND"
  | "ROOM_NOT_WAITING"
  | "ROOM_FULL"
  | "ROOM_IN_GAME"
  | "ROOM_BUSY"
  | "PLAYER_NOT_IN_ROOM"
  | "ONLY_OWNER_CAN_START"
  | "INVALID_PLAYER_COUNT"
  | "GAME_NOT_FOUND"
  | "GAME_NOT_PLAYING"
  | "NOT_YOUR_TURN"
  | "INVALID_CARD_COUNT"
  | "DUPLICATE_CARD_IDS"
  | "CARD_NOT_IN_HAND"
  | "DECLARED_RANK_REQUIRED"
  | "DECLARED_RANK_LOCKED"
  | "NO_LAST_PLAY"
  | "CANNOT_CHALLENGE_SELF"
  | "DATABASE_UNAVAILABLE"
  | "DATABASE_AUTH_FAILED"
  | "DATABASE_NOT_FOUND"
  | "DATABASE_SCHEMA_MISSING"
  | "REDIS_UNAVAILABLE";

type ErrorLogLevel = "warn" | "error" | "silent";

type AppErrorDefinition = {
  apiCode: ApiResponseCode;
  publicMessage: string;
  logLevel: ErrorLogLevel;
};

const APP_ERROR_DEFINITIONS: Record<AppErrorCode, AppErrorDefinition> = {
  UNKNOWN_ERROR: {
    apiCode: API_RESPONSE_CODE.UNKNOWN_ERROR,
    publicMessage: "操作失败",
    logLevel: "error",
  },
  VALIDATION_ERROR: {
    apiCode: API_RESPONSE_CODE.VALIDATION_ERROR,
    publicMessage: "请求参数无效",
    logLevel: "silent",
  },
  UNAUTHORIZED: {
    apiCode: API_RESPONSE_CODE.UNAUTHORIZED,
    publicMessage: "请先登录",
    logLevel: "silent",
  },
  AUTH_EXPIRED: {
    apiCode: API_RESPONSE_CODE.AUTH_EXPIRED,
    publicMessage: "登录已失效",
    logLevel: "silent",
  },
  EMAIL_ALREADY_REGISTERED: {
    apiCode: API_RESPONSE_CODE.EMAIL_ALREADY_REGISTERED,
    publicMessage: "邮箱已注册",
    logLevel: "silent",
  },
  NICKNAME_ALREADY_REGISTERED: {
    apiCode: API_RESPONSE_CODE.NICKNAME_ALREADY_REGISTERED,
    publicMessage: "昵称已被使用",
    logLevel: "silent",
  },
  INVALID_EMAIL_OR_PASSWORD: {
    apiCode: API_RESPONSE_CODE.INVALID_EMAIL_OR_PASSWORD,
    publicMessage: "邮箱或密码错误",
    logLevel: "silent",
  },
  ROOM_CODE_EXISTS: {
    apiCode: API_RESPONSE_CODE.ROOM_CODE_EXISTS,
    publicMessage: "房间码已存在",
    logLevel: "silent",
  },
  ROOM_NOT_FOUND: {
    apiCode: API_RESPONSE_CODE.ROOM_NOT_FOUND,
    publicMessage: "房间不存在",
    logLevel: "silent",
  },
  ROOM_NOT_WAITING: {
    apiCode: API_RESPONSE_CODE.ROOM_NOT_WAITING,
    publicMessage: "房间已开始",
    logLevel: "silent",
  },
  ROOM_FULL: {
    apiCode: API_RESPONSE_CODE.ROOM_FULL,
    publicMessage: "房间已满",
    logLevel: "silent",
  },
  ROOM_IN_GAME: {
    apiCode: API_RESPONSE_CODE.ROOM_IN_GAME,
    publicMessage: "对局进行中，暂时不能退出房间",
    logLevel: "silent",
  },
  ROOM_BUSY: {
    apiCode: API_RESPONSE_CODE.UNKNOWN_ERROR,
    publicMessage: "房间操作处理中，请稍后重试",
    logLevel: "silent",
  },
  PLAYER_NOT_IN_ROOM: {
    apiCode: API_RESPONSE_CODE.UNKNOWN_ERROR,
    publicMessage: "你不在这个房间",
    logLevel: "silent",
  },
  ONLY_OWNER_CAN_START: {
    apiCode: API_RESPONSE_CODE.UNKNOWN_ERROR,
    publicMessage: "只有房主可以开始游戏",
    logLevel: "silent",
  },
  INVALID_PLAYER_COUNT: {
    apiCode: API_RESPONSE_CODE.UNKNOWN_ERROR,
    publicMessage: "房间人数达到设定上限后才能开始",
    logLevel: "silent",
  },
  GAME_NOT_FOUND: {
    apiCode: API_RESPONSE_CODE.UNKNOWN_ERROR,
    publicMessage: "对局不存在",
    logLevel: "silent",
  },
  GAME_NOT_PLAYING: {
    apiCode: API_RESPONSE_CODE.UNKNOWN_ERROR,
    publicMessage: "对局未进行中",
    logLevel: "silent",
  },
  NOT_YOUR_TURN: {
    apiCode: API_RESPONSE_CODE.UNKNOWN_ERROR,
    publicMessage: "还没轮到你",
    logLevel: "silent",
  },
  INVALID_CARD_COUNT: {
    apiCode: API_RESPONSE_CODE.UNKNOWN_ERROR,
    publicMessage: "请选择 1 到 4 张牌",
    logLevel: "silent",
  },
  DUPLICATE_CARD_IDS: {
    apiCode: API_RESPONSE_CODE.UNKNOWN_ERROR,
    publicMessage: "不能重复选择同一张牌",
    logLevel: "silent",
  },
  CARD_NOT_IN_HAND: {
    apiCode: API_RESPONSE_CODE.UNKNOWN_ERROR,
    publicMessage: "选择的牌不在你的手牌中",
    logLevel: "silent",
  },
  DECLARED_RANK_REQUIRED: {
    apiCode: API_RESPONSE_CODE.UNKNOWN_ERROR,
    publicMessage: "请选择本回合声明的牌点",
    logLevel: "silent",
  },
  DECLARED_RANK_LOCKED: {
    apiCode: API_RESPONSE_CODE.UNKNOWN_ERROR,
    publicMessage: "本轮已声明牌点，只能跟牌",
    logLevel: "silent",
  },
  NO_LAST_PLAY: {
    apiCode: API_RESPONSE_CODE.UNKNOWN_ERROR,
    publicMessage: "当前没有可质疑的上一手",
    logLevel: "silent",
  },
  CANNOT_CHALLENGE_SELF: {
    apiCode: API_RESPONSE_CODE.UNKNOWN_ERROR,
    publicMessage: "不能质疑自己刚打出的牌",
    logLevel: "silent",
  },
  DATABASE_UNAVAILABLE: {
    apiCode: API_RESPONSE_CODE.DATABASE_UNAVAILABLE,
    publicMessage: "数据库未连接，请启动 PostgreSQL 并检查 DATABASE_URL",
    logLevel: "warn",
  },
  DATABASE_AUTH_FAILED: {
    apiCode: API_RESPONSE_CODE.DATABASE_AUTH_FAILED,
    publicMessage: "数据库账号或密码错误，请检查 DATABASE_URL",
    logLevel: "warn",
  },
  DATABASE_NOT_FOUND: {
    apiCode: API_RESPONSE_CODE.DATABASE_NOT_FOUND,
    publicMessage: "数据库不存在，请先创建 DATABASE_URL 指向的数据库",
    logLevel: "warn",
  },
  DATABASE_SCHEMA_MISSING: {
    apiCode: API_RESPONSE_CODE.DATABASE_SCHEMA_MISSING,
    publicMessage: "数据库表未初始化，请先执行 Prisma 迁移或同步",
    logLevel: "warn",
  },
  REDIS_UNAVAILABLE: {
    apiCode: API_RESPONSE_CODE.REDIS_UNAVAILABLE,
    publicMessage: "Redis 不可用，服务暂时不可用",
    logLevel: "warn",
  },
};

const KNOWN_APP_ERROR_CODES = new Set<AppErrorCode>(Object.keys(APP_ERROR_DEFINITIONS) as AppErrorCode[]);

export class AppError extends Error {
  code: AppErrorCode;
  publicMessage?: string;

  constructor(code: AppErrorCode, publicMessage?: string) {
    super(code);
    this.name = "AppError";
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

type NormalizedAppError = {
  code: AppErrorCode;
  apiCode: ApiResponseCode;
  publicMessage: string;
  logLevel: ErrorLogLevel;
};

function isKnownAppErrorCode(value: string): value is AppErrorCode {
  return KNOWN_APP_ERROR_CODES.has(value as AppErrorCode);
}

function inferAppErrorCode(error: unknown): AppErrorCode {
  if (error instanceof AppError) {
    return error.code;
  }

  const rawCode = error instanceof Error ? error.message : "UNKNOWN_ERROR";

  if (isKnownAppErrorCode(rawCode)) {
    return rawCode;
  }

  if (rawCode.includes("Unique constraint failed") || rawCode.includes("P2002")) {
    return "EMAIL_ALREADY_REGISTERED";
  }

  if (
    rawCode.includes("Can't reach database server") ||
    rawCode.includes("Environment variable not found") ||
    rawCode.includes("ECONNREFUSED")
  ) {
    return "DATABASE_UNAVAILABLE";
  }

  if (rawCode.includes("Authentication failed against database server")) {
    return "DATABASE_AUTH_FAILED";
  }

  if (rawCode.includes("does not exist in the current database") || rawCode.includes("P2021")) {
    return "DATABASE_SCHEMA_MISSING";
  }

  if (rawCode.includes("does not exist") || rawCode.includes("P1003")) {
    return "DATABASE_NOT_FOUND";
  }

  if (rawCode.includes("REDIS_UNAVAILABLE")) {
    return "REDIS_UNAVAILABLE";
  }

  return "UNKNOWN_ERROR";
}

export function normalizeAppError(error: unknown): NormalizedAppError {
  const code = inferAppErrorCode(error);
  const definition = APP_ERROR_DEFINITIONS[code];
  const publicMessage =
    error instanceof AppError && error.publicMessage
      ? error.publicMessage
      : definition.publicMessage;

  return {
    code,
    apiCode: definition.apiCode,
    publicMessage,
    logLevel: definition.logLevel,
  };
}

export function toApiErrorPayload(error: unknown): ApiErrorPayload {
  const normalized = normalizeAppError(error);
  return {
    code: normalized.apiCode,
    message: normalized.publicMessage,
  };
}

export function toSocketErrorPayload(error: unknown) {
  const normalized = normalizeAppError(error);
  return {
    code: normalized.code,
    message: normalized.publicMessage,
  };
}

export function reportAppError(scope: string, error: unknown, context: Record<string, unknown> = {}) {
  const normalized = normalizeAppError(error);

  if (normalized.logLevel === "warn") {
    logger.warn("handled application error", {
      scope,
      appErrorCode: normalized.code,
      ...context,
      ...errorContext(error),
    });
  }

  if (normalized.logLevel === "error") {
    logger.error("unhandled application error", {
      scope,
      appErrorCode: normalized.code,
      ...context,
      ...errorContext(error),
    });
  }

  return normalized;
}
