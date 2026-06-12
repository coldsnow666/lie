/**
 * @Description: 验证统一错误模型对领域错误和基础设施错误的映射行为。
 *
 * @Date 2026-06-12 14:47
 */
import { describe, expect, it } from "vitest";
import { AppError, normalizeAppError } from "./errors";

describe("normalizeAppError", () => {
  it("maps known domain errors", () => {
    expect(normalizeAppError(new AppError("ROOM_FULL"))).toMatchObject({
      code: "ROOM_FULL",
      publicMessage: "房间已满",
    });
  });

  it("maps duplicate nickname errors", () => {
    expect(normalizeAppError(new Error("NICKNAME_ALREADY_REGISTERED"))).toMatchObject({
      code: "NICKNAME_ALREADY_REGISTERED",
      publicMessage: "昵称已被使用",
    });
  });

  it("maps database reachability failures", () => {
    expect(normalizeAppError(new Error("Can't reach database server at localhost:5432"))).toMatchObject({
      code: "DATABASE_UNAVAILABLE",
      publicMessage: "数据库未连接，请启动 PostgreSQL 并检查 DATABASE_URL",
    });
  });

  it("falls back to unknown errors", () => {
    expect(normalizeAppError(new Error("something broke"))).toMatchObject({
      code: "UNKNOWN_ERROR",
      publicMessage: "操作失败",
    });
  });
});
