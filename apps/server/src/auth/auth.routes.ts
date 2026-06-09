/**
 * 认证 HTTP 路由：提供注册、登录、当前用户和退出登录接口。
 */
import { API_RESPONSE_CODE } from "@lie/shared";
import type { FastifyInstance } from "fastify";
import { loginSchema, registerSchema } from "@lie/shared";
import { sendError, sendOk, type ApiErrorPayload } from "../utils/response";
import { getUserById, loginUser, registerUser } from "./auth.service";
import { requireAuth } from "./auth.middleware";

function errorPayload(error: unknown): ApiErrorPayload {
  const rawCode = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const errors: Record<string, ApiErrorPayload> = {
    EMAIL_ALREADY_REGISTERED: {
      code: API_RESPONSE_CODE.EMAIL_ALREADY_REGISTERED,
      message: "邮箱已注册",
    },
    INVALID_EMAIL_OR_PASSWORD: {
      code: API_RESPONSE_CODE.INVALID_EMAIL_OR_PASSWORD,
      message: "邮箱或密码错误",
    },
    UNKNOWN_ERROR: {
      code: API_RESPONSE_CODE.UNKNOWN_ERROR,
      message: "请求处理失败",
    },
  };
  const payload = errors[rawCode] ?? errors.UNKNOWN_ERROR;
  // Prisma 的数据库错误只暴露可操作的中文提示，不把原始连接串或堆栈传给客户端。
  const databaseUnavailable =
    rawCode.includes("Can't reach database server") ||
    rawCode.includes("Environment variable not found") ||
    rawCode.includes("ECONNREFUSED");
  const databaseAuthFailed = rawCode.includes("Authentication failed against database server");
  const databaseMissing = rawCode.includes("does not exist") || rawCode.includes("P1003");
  const databaseSchemaMissing = rawCode.includes("does not exist in the current database") || rawCode.includes("P2021");

  if (databaseUnavailable) {
    return {
      code: API_RESPONSE_CODE.DATABASE_UNAVAILABLE,
      message: "数据库未连接，请启动 PostgreSQL 并检查 DATABASE_URL",
    };
  }

  if (databaseAuthFailed) {
    return {
      code: API_RESPONSE_CODE.DATABASE_AUTH_FAILED,
      message: "数据库账号或密码错误，请检查 DATABASE_URL",
    };
  }

  if (databaseMissing) {
    return {
      code: API_RESPONSE_CODE.DATABASE_NOT_FOUND,
      message: "数据库不存在，请先创建 DATABASE_URL 指向的数据库",
    };
  }

  if (databaseSchemaMissing) {
    return {
      code: API_RESPONSE_CODE.DATABASE_SCHEMA_MISSING,
      message: "数据库表未初始化，请先执行 Prisma 迁移或同步",
    };
  }

  return payload;
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);

    if (!parsed.success) {
      return sendError(reply, {
        code: API_RESPONSE_CODE.VALIDATION_ERROR,
        message: parsed.error.issues[0]?.message ?? "注册信息无效",
      });
    }

    try {
      const auth = await registerUser(parsed.data);
      return sendOk(reply, auth);
    } catch (error) {
      return sendError(reply, errorPayload(error));
    }
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      return sendError(reply, {
        code: API_RESPONSE_CODE.VALIDATION_ERROR,
        message: parsed.error.issues[0]?.message ?? "登录信息无效",
      });
    }

    try {
      const auth = await loginUser(parsed.data);
      return sendOk(reply, auth);
    } catch (error) {
      return sendError(reply, errorPayload(error));
    }
  });

  app.get("/auth/me", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user ? await getUserById(request.user.id) : null;

    if (!user) {
      return sendError(reply, {
        code: API_RESPONSE_CODE.AUTH_EXPIRED,
        message: "登录已失效",
      });
    }

    return sendOk(reply, { user });
  });

  app.post("/auth/logout", { preHandler: requireAuth }, async (_request, reply) =>
    sendOk(reply, { success: true }),
  );
}
