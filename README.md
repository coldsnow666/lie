# Lie

实时多人「Liar / Cheat / Bullshit / Liar」Web 卡牌游戏。

本仓库按 `README.zh-CN.md` 的第一版设计落地：

- `apps/web`：Next.js 前端。
- `apps/game-server`：Fastify + Socket.IO 游戏服务端。
- `packages/shared`：共享 TypeScript 规则、牌面和 Zod schema。

## 开发

```bash
pnpm install
pnpm prisma:generate
pnpm dev
```

本地数据库与缓存：

请提前准备可连接的 PostgreSQL 和 Redis 服务，可以使用本机安装或远程开发服务。
