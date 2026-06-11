/**
 * 认证 HTTP 路由：提供注册、登录、当前用户和退出登录接口。
 */
import { API_RESPONSE_CODE } from "@lie/shared";
import type { FastifyInstance } from "fastify";
import { loginSchema, registerSchema } from "@lie/shared";
import { reportAppError, toApiErrorPayload } from "../utils/errors";
import { sendError, sendOk } from "../utils/response";
import { getUserById, loginUser, registerUser } from "./auth.service";
import { requireAuth } from "./auth.middleware";

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
      reportAppError("http.auth.register", error, { email: parsed.data.email });
      return sendError(reply, toApiErrorPayload(error));
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
      reportAppError("http.auth.login", error, { email: parsed.data.email });
      return sendError(reply, toApiErrorPayload(error));
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
