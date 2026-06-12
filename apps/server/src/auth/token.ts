/**
 * @Description: 访问令牌工具：签发和校验用于 HTTP 与 Socket 鉴权的 JWT。
 *
 * @Date 2026-06-12 14:47
 */
import jwt from "jsonwebtoken";
import { env } from "../env";

export type AuthUser = {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
};

type TokenPayload = {
  sub: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
};

export function signAccessToken(user: AuthUser) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
    },
    env.JWT_SECRET,
    { expiresIn: "7d" },
  );
}

export function verifyAccessToken(token?: string | null): AuthUser | null {
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;

    if (!payload.sub) {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
      nickname: payload.nickname,
      avatarUrl: payload.avatarUrl ?? null,
    };
  } catch {
    return null;
  }
}
