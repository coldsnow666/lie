/**
 * Prisma 客户端实例：集中初始化数据库访问，并确保环境变量先加载。
 */
import "../env";
import { PrismaClient } from "../generated/prisma/index";

export const prisma = new PrismaClient();
