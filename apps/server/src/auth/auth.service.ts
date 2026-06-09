/**
 * 认证业务服务：处理注册、登录、当前用户查询和密码校验。
 */
import type { LoginInput, RegisterInput } from "@lie/shared";
import { prisma } from "../db/prisma";
import { hashPassword, verifyPassword } from "./password";
import { signAccessToken, type AuthUser } from "./token";

function toAuthUser(user: {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
  };
}

export async function registerUser(input: RegisterInput) {
  // 注册前先查重，避免把 Prisma unique constraint 错误直接暴露给前端。
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existing) {
    throw new Error("EMAIL_ALREADY_REGISTERED");
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      nickname: input.nickname,
      passwordHash: hashPassword(input.password),
      lastLoginAt: new Date(),
    },
    select: {
      id: true,
      email: true,
      nickname: true,
      avatarUrl: true,
    },
  });

  const authUser = toAuthUser(user);

  return {
    user: authUser,
    accessToken: signAccessToken(authUser),
  };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    throw new Error("INVALID_EMAIL_OR_PASSWORD");
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    select: {
      id: true,
      email: true,
      nickname: true,
      avatarUrl: true,
    },
  });

  const authUser = toAuthUser(updated);

  return {
    user: authUser,
    accessToken: signAccessToken(authUser),
  };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      nickname: true,
      avatarUrl: true,
    },
  });

  return user ? toAuthUser(user) : null;
}
