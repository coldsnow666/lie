/**
 * HTTP 鉴权中间件：从 Authorization Bearer token 中解析当前用户。
 */
import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyAccessToken, type AuthUser } from "./token";

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  const user = verifyAccessToken(token);

  if (!user) {
    return reply.code(401).send({
      error: {
        code: "UNAUTHORIZED",
        message: "请先登录",
      },
    });
  }

  request.user = user;
}
