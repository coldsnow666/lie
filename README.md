# Lie

实时多人「唬牌 / Cheat / Bullshit / Liar」Web 卡牌游戏。

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

```bash
docker compose up -d
```
