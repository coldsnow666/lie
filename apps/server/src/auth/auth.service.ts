/**
 * @Description: 认证业务服务：处理注册、登录、当前用户查询和密码校验。
 *
 * @Date 2026-06-12 14:47
 */
import type { LoginInput, RegisterInput } from "@lie/shared";
import { Prisma } from "../generated/prisma/index";
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

function uniqueRegisterError(error: Prisma.PrismaClientKnownRequestError) {
  const target = Array.isArray(error.meta?.target) ? error.meta.target : [];

  return target.includes("nickname") ? "NICKNAME_ALREADY_REGISTERED" : "EMAIL_ALREADY_REGISTERED";
}

export async function registerUser(input: RegisterInput) {
  // 注册前先查重，避免把 Prisma unique constraint 错误直接暴露给前端。
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: input.email },
        { nickname: input.nickname },
      ],
    },
    select: {
      email: true,
      nickname: true,
    },
  });

  if (existing?.email === input.email) {
    throw new Error("EMAIL_ALREADY_REGISTERED");
  }

  if (existing?.nickname === input.nickname) {
    throw new Error("NICKNAME_ALREADY_REGISTERED");
  }

  let user;
  try {
    user = await prisma.user.create({
      data: {
        email: input.email,
        nickname: input.nickname,
        passwordHash: await hashPassword(input.password),
        lastLoginAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        avatarUrl: true,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error(uniqueRegisterError(error));
    }
    throw error;
  }

  const authUser = toAuthUser(user);

  return {
    user: authUser,
    accessToken: signAccessToken(authUser),
  };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      nickname: true,
      avatarUrl: true,
      passwordHash: true,
    },
  });

  if (!user) {
    throw new Error("INVALID_EMAIL_OR_PASSWORD");
  }

  const passwordVerification = await verifyPassword(input.password, user.passwordHash);
  if (!passwordVerification.valid) {
    throw new Error("INVALID_EMAIL_OR_PASSWORD");
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      ...(passwordVerification.needsRehash ? { passwordHash: await hashPassword(input.password) } : {}),
    },
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
