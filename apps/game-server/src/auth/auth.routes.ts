/**
 * 认证 HTTP 路由：提供注册、登录、当前用户和退出登录接口。
 */
import type { FastifyInstance } from "fastify";
import { loginSchema, registerSchema } from "@lie/shared";
import { getUserById, loginUser, registerUser } from "./auth.service";
import { requireAuth } from "./auth.middleware";

function errorPayload(error: unknown) {
  const rawCode = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const messages: Record<string, string> = {
    EMAIL_ALREADY_REGISTERED: "邮箱已注册",
    INVALID_EMAIL_OR_PASSWORD: "邮箱或密码错误",
  };
  const code = rawCode in messages ? rawCode : "UNKNOWN_ERROR";
  // 数据库未启动时返回稳定错误码，避免把 Prisma 原始堆栈泄露给客户端。
  const databaseUnavailable =
    rawCode.includes("Can't reach database server") ||
    rawCode.includes("Environment variable not found") ||
    rawCode.includes("ECONNREFUSED");

  return {
    code: databaseUnavailable ? "DATABASE_UNAVAILABLE" : code,
    message: databaseUnavailable ? "数据库未连接，请启动 PostgreSQL 并执行 Prisma 初始化" : messages[code] ?? "请求处理失败",
  };
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "注册信息无效",
        },
      });
    }

    try {
      return await registerUser(parsed.data);
    } catch (error) {
      return reply.code(400).send({ error: errorPayload(error) });
    }
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "登录信息无效",
        },
      });
    }

    try {
      return await loginUser(parsed.data);
    } catch (error) {
      return reply.code(401).send({ error: errorPayload(error) });
    }
  });

  app.get("/auth/me", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user ? await getUserById(request.user.id) : null;

    if (!user) {
      return reply.code(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "登录已失效",
        },
      });
    }

    return { user };
  });

  app.post("/auth/logout", { preHandler: requireAuth }, async () => ({
    ok: true,
  }));
}
