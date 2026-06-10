# Lie Web 第一版MVP

本文档是一份给 AI 编程助手或开发者使用的产品与技术设计说明，用于实现一个类似「唬牌」「吹牛牌」「抓骗子」「Cheat / Bullshit / Liar」的实时多人 Web 卡牌游戏。

## 1. 项目目标

构建一个实时多人网页卡牌游戏。玩家轮流将牌面朝下打出，并声明自己打出的牌点。其他玩家可以选择相信，也可以质疑上一手是否在撒谎。

第一版优先保证：

- 规则清晰。
- 回合流转稳定。
- 服务端权威判定。
- 房间实时同步顺畅。
- MVP 功能完整但不过度扩展。

第一版不要急着加入排行榜、皮肤、付费、复杂 AI、语音聊天或大型社交系统，除非后续明确要求。

## 2. 推荐技术栈

第一版必须使用 `pnpm + workspace` 管理 monorepo。

```txt
lie/
  package.json
  pnpm-workspace.yaml
  apps/
    web/           # Next.js 前端
    server/   # Node.js 游戏服务端
  packages/
    shared/        # 共享 TypeScript 工具、Zod schema、规则模块
```

推荐技术栈：

- 前端：Next.js 最新稳定版 + React + TypeScript。
- 当前确认的 npm latest 版本：`next@16.2.7`，但初始化时仍使用 `@latest`。
- 实时通信：Socket.IO。
- 游戏服务端：Node.js + Fastify + Socket.IO + TypeScript。
- 参数校验：Zod。
- 数据库：PostgreSQL。
- ORM：Prisma 或 Drizzle。MVP 阶段优先 Prisma。
- 缓存与对局热状态：Redis。
- 包管理器：pnpm workspace。

不要把实时游戏循环直接塞进 Next.js API Routes。Next.js 负责页面和 UI，游戏服务端单独运行，前端通过 Socket.IO 连接游戏服务。

### 2.1 初始化要求

前端使用最新版 Next.js，并明确启用 TypeScript：

```bash
pnpm create next-app@latest apps/web --ts --use-pnpm
```

如果 `create-next-app` 询问选项，建议：

- App Router：启用。
- ESLint：启用。
- Tailwind CSS：启用。
- `src/` 目录：启用。
- TypeScript：启用。
- Import alias：可使用默认值。

根目录 `package.json` 示例：

```tson
{
  "name": "lie",
  "private": true,
  "scripts": {
    "dev": "pnpm --parallel --filter @lie/web --filter @lie/server dev",
    "dev:web": "pnpm --filter @lie/web dev",
    "dev:server": "pnpm --filter @lie/server dev",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test"
  },
  "packageManager": "pnpm@latest"
}
```

根目录 `pnpm-workspace.yaml`：

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 2.2 第一版项目目录

第一版建议按以下目录输出：

```txt
lie/
  README.md
  README.zh-CN.md
  package.json
  pnpm-workspace.yaml
  .env.example
  apps/
    web/
      package.json
      next.config.mjs
      tsconfig.json
      public/
      src/
        app/
          layout.tsx
          page.tsx
          start/
            page.tsx
          login/
            page.tsx
          register/
            page.tsx
          lobby/
            page.tsx
          room/
            [roomCode]/
              page.tsx
        components/
          start/
            StartScreen.tsx
          auth/
            LoginForm.tsx
            RegisterForm.tsx
          game/
            Card.tsx
            Hand.tsx
            PlayerSeat.tsx
            GameTable.tsx
            EventLog.tsx
          layout/
            AppShell.tsx
        lib/
          api.ts
          socket.ts
          auth.ts
        styles/
          globals.css
    server/
      package.json
      prisma/
        schema.prisma
        migrations/
      src/
        index.ts
        env.ts
        app.ts
        socket.ts
        db/
          prisma.ts
        auth/
          auth.routes.ts
          auth.service.ts
          auth.middleware.ts
          password.ts
          token.ts
        rooms/
          room.routes.ts
          room.service.ts
          room.store.ts
        game/
          deck.ts
          engine.ts
          public-state.ts
        redis/
          client.ts
          locks.ts
        events/
          client-events.ts
          server-events.ts
        schemas/
          auth.schemas.ts
          room.schemas.ts
          game.schemas.ts
    shared/
      package.json
      src/
        cards.ts
        ranks.ts
        rules.ts
        schemas.ts
        constants.ts
```

目录原则：

- `apps/web` 只负责 UI、页面路由、调用 HTTP API、连接 Socket.IO。
- `apps/server` 负责注册登录、房间、游戏状态、Socket.IO、Redis、PostgreSQL。
- `packages/shared` 只放纯 TypeScript 工具和 Zod schema，不依赖 React、Fastify、Redis 或数据库。

## 3. 核心玩法

### 3.1 MVP 规则

第一版使用以下规则：

- 使用一副标准 52 张扑克牌。
- 不使用大小王。
- 支持 2 到 6 名玩家。
- 开局尽量平均发完所有牌。
- 玩家按座位顺时针轮流行动。
- 游戏声明牌点按固定顺序推进：
  `A -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> J -> Q -> K -> A`。
- 当前回合的目标牌点对所有玩家公开。
- 当前玩家必须从手牌中选择 1 到 4 张牌，牌面朝下打出。
- 玩家声明这些牌都是当前目标牌点。
- 实际打出的牌可以是真的，也可以是假的。
- 出牌后，下一个玩家可以：
  - 质疑上一手；
  - 或相信上一手，并继续自己的回合。
- 如果有人质疑，则翻开上一手牌：
  - 如果上一手玩家撒谎，上一手玩家拿走整个弃牌堆。
  - 如果上一手玩家没有撒谎，质疑者拿走整个弃牌堆。
- 质疑结算后，由拿走牌堆的玩家继续进入正常回合流转。
- 第一个在出牌后手牌数变为 0 的玩家获胜。

### 3.2 真假判定

只有当上一手实际打出的所有牌都等于声明牌点时，才算真话。

示例：

```ts
declaredRank = "Q"
actualCards = ["QS", "QH"]
truthful = true

declaredRank = "Q"
actualCards = ["QS", "7H"]
truthful = false
```

### 3.3 隐藏信息约束

服务端可以知道所有真实牌面，客户端不能收到不该知道的信息。

每个玩家：

- 可以看到自己的手牌。
- 可以看到其他玩家的剩余手牌数量。
- 可以看到上一手的声明牌点和声明数量。
- 不能看到其他玩家的手牌。
- 不能看到弃牌堆里的真实牌，除非发生质疑并揭示上一手。

## 4. 主要页面

### 4.1 启动页

第一版需要有传统游戏风格的启动页。根路径 `/` 默认展示启动页，不直接进入大厅。

必需功能：

- 展示游戏名称。
- 展示主按钮：进入游戏。
- 如果用户已登录，点击进入游戏跳转 `/lobby`。
- 如果用户未登录，点击进入游戏跳转 `/login`。
- 提供注册入口。
- 提供基础设置入口，例如音效开关。
- 展示版本号，例如 `v0.1.0`。
- 可选：展示卡牌桌面背景、开始动画、加载状态。

启动页不要做成营销落地页。它应该像传统游戏主菜单，是玩家进入游戏的第一屏。

### 4.2 注册页

必需功能：

- 输入昵称。
- 输入邮箱。
- 输入密码。
- 确认密码。
- 提交注册。
- 注册成功后自动登录并进入大厅。
- 显示表单校验错误。

### 4.3 登录页

必需功能：

- 输入邮箱。
- 输入密码。
- 提交登录。
- 登录成功后进入大厅。
- 提供跳转注册页入口。
- 显示登录失败原因。

### 4.4 大厅页

必需功能：

- 必须登录后访问。
- 显示当前用户昵称。
- 创建房间。
- 通过房间码加入房间。
- 显示基础连接状态。
- 退出登录。

### 4.5 等待房间页

必需功能：

- 显示房间码。
- 显示已加入玩家。
- 房主在 2 到 6 人时可以开始游戏。
- 玩家可以离开房间。
- 可选：准备状态。

### 4.6 游戏页

必需功能：

- 展示桌面和玩家座位。
- 展示每个玩家的昵称、座位、剩余牌数、连接状态。
- 高亮当前行动玩家。
- 展示当前目标牌点。
- 展示中央弃牌堆数量。
- 展示上一手声明：
  - 玩家昵称；
  - 声明牌点；
  - 声明数量。
- 展示本地玩家手牌。
- 当前玩家可以选择 1 到 4 张牌。
- 提供操作按钮：
  - 打出所选牌；
  - 质疑上一手。
- 展示简洁的事件日志。
- 游戏结束时展示获胜者。

## 5. 第一版注册与登录

第一版需要实现基础账号系统，所有创建房间、加入房间、开始游戏和对局操作都要求登录。

### 5.1 账号规则

- 用户使用邮箱和密码注册。
- 邮箱全站唯一。
- 昵称长度建议为 2 到 16 个字符。
- 密码长度至少 8 位。
- 密码不能明文存入数据库。
- 第一版按指定方案使用两次 MD5 后存入数据库。
- 推荐存储格式为 `md5(md5(password) + PASSWORD_HASH_SECRET)`。
- 如果不使用额外 secret，则至少使用 `md5(md5(password))`。
- 登录成功后返回访问 token。
- 前端将 token 保存在安全位置。MVP 可以先使用 `localStorage`，更稳妥的正式方案是 HttpOnly Cookie。

`apps/server/src/auth/password.ts` 示例：

```ts
import crypto from "node:crypto"

function md5(value: string): string {
  return crypto.createHash("md5").update(value).digest("hex")
}

export function hashPassword(password: string): string {
  const first = md5(password)
  return md5(`${first}${process.env.PASSWORD_HASH_SECRET || ""}`)
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  return hashPassword(password) === passwordHash
}
```

注意：两次 MD5 是第一版指定实现，优点是简单。后续如果进入正式生产环境，建议迁移到更强的密码哈希算法，并提供兼容旧密码哈希的升级逻辑。

### 5.2 HTTP API

注册、登录和当前用户信息走游戏服务端 REST API，由 `apps/server` 提供。

```txt
POST /auth/register
POST /auth/login
GET  /auth/me
POST /auth/logout
```

请求与响应示例：

```ts
// POST /auth/register
{
  "email": "player@example.com",
  "nickname": "玩家A",
  "password": "password123"
}

// POST /auth/login
{
  "email": "player@example.com",
  "password": "password123"
}

// success response
{
  "user": {
    "id": "uuid",
    "email": "player@example.com",
    "nickname": "玩家A",
    "avatarUrl": null
  },
  "accessToken": "jwt-or-session-token"
}
```

### 5.3 Token 与 Socket.IO 鉴权

Socket.IO 连接时必须携带登录 token：

```ts
import { io } from "socket.io-client"

export function createSocket(accessToken: string) {
  return io(process.env.NEXT_PUBLIC_GAME_SERVER_URL, {
    auth: {
      token: accessToken
    }
  })
}
```

服务端在 Socket.IO middleware 中校验 token，并将用户信息绑定到 socket：

```ts
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token
  const user = await verifyAccessToken(token)

  if (!user) {
    return next(new Error("UNAUTHORIZED"))
  }

  socket.data.user = user
  next()
})
```

所有房间和游戏事件都从 `socket.data.user.id` 读取当前用户，不允许客户端提交 `userId`。

### 5.4 前端登录态

前端需要提供：

- `lib/auth.ts`：保存、读取、清除 token 和当前用户。
- `lib/api.ts`：封装 fetch，自动带上 `Authorization: Bearer <token>`。
- 登录后跳转 `/lobby`。
- 未登录访问 `/lobby`、`/room/[roomCode]` 时跳转 `/login`。
- 退出登录时清除 token，并断开 Socket.IO。

## 6. 服务端权威

游戏服务端是唯一权威来源。

客户端只发送“行动意图”，不发送最终游戏状态。

示例：

```ts
socket.emit("game:playCards", {
  roomId,
  cardIds
})

socket.emit("game:challenge", {
  roomId
})
```

服务端必须负责：

- 校验 socket 是否属于该房间玩家。
- 校验当前游戏阶段。
- 校验是否轮到该玩家。
- 校验选择的牌是否真的在该玩家手里。
- 校验出牌数量是否为 1 到 4。
- 根据规则更新游戏状态。
- 写入 Redis 或数据库。
- 向房间广播脱敏后的公开状态。

永远不要信任客户端传来的游戏状态。

## 7. 领域模型

### 7.1 Card

```ts
export type Suit = "S" | "H" | "D" | "C"
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K"

export type Card = {
  id: string       // 示例："AS", "10H"
  rank: Rank
  suit: Suit
}
```

### 7.2 服务端私有游戏状态

该状态只存在于服务端和 Redis，不能完整发送给客户端。

```ts
export type PrivateGameState = {
  matchId: string
  roomId: string
  status: "waiting" | "playing" | "finished" | "abandoned"
  players: PlayerState[]
  hands: Record<string, Card[]>
  discardPile: PlayedCard[]
  currentPlayerId: string | null
  currentRank: Rank
  lastPlay: LastPlay | null
  turnSeq: number
  winnerPlayerId: string | null
  createdAt: number
  updatedAt: number
}

export type PlayerState = {
  playerId: string
  userId: string
  nickname: string
  seatIndex: number
  socketId: string | null
  connected: boolean
  ready: boolean
}

export type PlayedCard = {
  card: Card
  playedByPlayerId: string
  turnSeq: number
}

export type LastPlay = {
  playerId: string
  declaredRank: Rank
  declaredCount: number
  actualCards: Card[]
  turnSeq: number
}
```

### 7.3 客户端公开游戏状态

该状态可以发送给指定玩家。

```ts
export type PublicGameState = {
  matchId: string
  roomId: string
  status: "waiting" | "playing" | "finished" | "abandoned"
  players: PublicPlayerState[]
  selfHand: Card[]
  discardPileCount: number
  currentPlayerId: string | null
  currentRank: Rank
  lastPlay: PublicLastPlay | null
  turnSeq: number
  winnerPlayerId: string | null
}

export type PublicPlayerState = {
  playerId: string
  nickname: string
  seatIndex: number
  connected: boolean
  ready: boolean
  cardCount: number
}

export type PublicLastPlay = {
  playerId: string
  declaredRank: Rank
  declaredCount: number
  turnSeq: number
}
```

## 8. Socket 事件协议

使用明确的 Socket.IO 事件名，并用 TypeScript 类型约束事件协议。每个 payload 仍然需要 Zod schema 做运行时校验。

### 8.1 客户端发给服务端

```ts
type Ack<T> = (result: T) => void

export type ClientToServerEvents = {
  "room:create": (payload: { roomCode?: string }, ack: Ack<CreateRoomResult>) => void
  "room:join": (payload: { roomCode: string }, ack: Ack<JoinRoomResult>) => void
  "room:leave": (payload: { roomId: string }, ack: Ack<LeaveRoomResult>) => void
  "room:ready": (payload: { roomId: string; ready: boolean }, ack: Ack<ReadyResult>) => void
  "game:start": (payload: { roomId: string }, ack: Ack<StartGameResult>) => void
  "game:playCards": (payload: { roomId: string; cardIds: string[] }, ack: Ack<PlayCardsResult>) => void
  "game:challenge": (payload: { roomId: string }, ack: Ack<ChallengeResult>) => void
  "game:sync": (payload: { roomId: string }, ack: Ack<SyncResult>) => void
}
```

所有需要响应的事件都使用 ack：

```ts
function ack<T>(result: T) {
  // 成功：{ ok: true, data: {...} }
  // 失败：{ ok: false, error: { code: "ERROR_CODE", message: "错误信息" } }
}
```

### 8.2 服务端发给客户端

```ts
export type ServerToClientEvents = {
  "room:updated": (state: PublicGameState) => void
  "game:updated": (state: PublicGameState) => void
  "game:event": (event: PublicGameEvent) => void
  "game:challengeResolved": (payload: PublicChallengeResult) => void
  "game:finished": (payload: { winnerPlayerId: string; state: PublicGameState }) => void
  "error:message": (payload: { code: string; message: string }) => void
}
```

### 8.3 公开游戏事件

```ts
export type PublicGameEvent =
  | {
      type: "cards_played"
      actorPlayerId: string
      declaredRank: Rank
      declaredCount: number
      turnSeq: number
    }
  | {
      type: "challenge_resolved"
      challengerPlayerId: string
      challengedPlayerId: string
      wasTruthful: boolean
      revealedCards: Card[]
      pileTakenByPlayerId: string
      turnSeq: number
    }
  | {
      type: "player_connected" | "player_disconnected"
      playerId: string
    }
```

## 9. 数据库设计

使用 PostgreSQL 存储长期数据、历史记录和统计数据。

### 9.1 表结构

```txt
users
  id uuid primary key
  email text unique not null
  nickname text not null
  avatar_url text null
  password_hash text not null
  last_login_at timestamptz null
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()

rooms
  id uuid primary key
  code text unique not null
  status text not null
  owner_user_id uuid null references users(id)
  max_players int not null
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()

matches
  id uuid primary key
  room_id uuid not null references rooms(id)
  status text not null
  rule_set jsonb not null
  deck_seed text not null
  started_at timestamptz null
  ended_at timestamptz null
  winner_player_id uuid null
  final_snapshot jsonb null
  created_at timestamptz not null default now()

match_players
  id uuid primary key
  match_id uuid not null references matches(id)
  user_id uuid null references users(id)
  player_id text not null
  nickname text not null
  seat_index int not null
  final_rank int null
  cards_left int null
  is_winner boolean not null default false

match_events
  id uuid primary key
  match_id uuid not null references matches(id)
  seq int not null
  type text not null
  actor_player_id text null
  payload jsonb not null
  created_at timestamptz not null default now()

player_stats
  user_id uuid primary key references users(id)
  games_played int not null default 0
  games_won int not null default 0
  challenges_made int not null default 0
  challenges_success int not null default 0
  bluffs_made int not null default 0
  bluffs_caught int not null default 0
  updated_at timestamptz not null default now()
```

第一版必须支持注册和登录，`users` 是基础表。`match_players.player_id` 仍然必须保留，因为一名用户在某一局内需要一个稳定的玩家身份和座位身份。

### 9.2 写入策略

对局进行中：

- Redis 是当前对局状态的主要来源。
- PostgreSQL 存储对局元信息和事件历史。
- 不要让高频回合操作阻塞在重型数据库统计更新上。

对局结束时：

- 使用一次数据库事务更新：
  - `matches`；
  - `match_players`；
  - `player_stats`；
  - 最后的 `match_events`。

## 10. Redis 缓存设计

使用 Redis 存储活跃房间和正在进行的对局状态。

### 10.1 Key 设计

```txt
room:{roomId}:state          # JSON 私有房间/游戏状态
room:{roomCode}:id           # 房间码到 roomId 的映射
match:{matchId}:state        # JSON PrivateGameState
match:{matchId}:events       # Redis Stream 或 List，记录最近事件
match:{matchId}:lock         # 短锁，防止并发修改回合
match:{matchId}:seq          # 回合/事件序号
socket:{socketId}:player     # socket 到 player 的映射
player:{playerId}:room       # player 到 room 的映射
```

### 10.2 TTL 策略

建议 TTL：

- 等待中房间：最后活动后 2 小时。
- 进行中对局：最后活动后 6 小时。
- 已结束对局：结束后 1 小时。
- Socket 映射：短 TTL，并在活动时刷新。

### 10.3 状态变更流程

每次游戏操作按以下流程处理：

```txt
1. 接收 Socket.IO 事件。
2. 使用 Zod 校验 payload。
3. 获取 match lock。
4. 从 Redis 读取 PrivateGameState。
5. 校验行动玩家和游戏阶段。
6. 调用纯游戏引擎函数计算新状态。
7. 将新的 PrivateGameState 写回 Redis。
8. 将事件追加到 Redis events。
9. 释放锁。
10. 向 Socket.IO 房间广播 PublicGameState。
11. 异步写入 PostgreSQL match_events。
```

锁必须设置较短过期时间，避免异常情况下死锁。

## 11. 游戏引擎

游戏规则尽量写成纯函数，方便测试和复盘。

推荐文件：

```txt
packages/shared/src/cards.ts
packages/shared/src/rules.ts
packages/shared/src/events.ts
apps/server/src/game/deck.ts
apps/server/src/game/engine.ts
apps/server/src/game/public-state.ts
```

核心函数：

```ts
export function createDeck(): Card[] {}
export function shuffleDeck(deck: Card[], seed: string): Card[] {}
export function dealCards(deck: Card[], players: PlayerState[]): Record<string, Card[]> {}
export function getNextRank(rank: Rank): Rank {}
export function getNextPlayer(players: PlayerState[], currentPlayerId: string): PlayerState {}
export function playCards(state: PrivateGameState, actorPlayerId: string, cardIds: string[]): PrivateGameState {}
export function challengeLastPlay(state: PrivateGameState, challengerPlayerId: string): ChallengeResolution {}
export function toPublicGameState(state: PrivateGameState, viewerPlayerId: string): PublicGameState {}
```

游戏引擎不应该依赖 Socket.IO、Fastify、Redis 或数据库。

## 12. 校验规则

每个客户端操作都必须在服务端校验。

### 12.1 出牌

以下情况拒绝：

- 对局状态不是 `playing`。
- 行动者不是当前玩家。
- 出牌数量小于 1 或大于 4。
- 选择的 card id 有重复。
- 任意选择的牌不在该玩家手牌中。

出牌成功后：

- 从该玩家手牌中移除这些牌。
- 将这些牌加入弃牌堆。
- 设置 `lastPlay`。
- 推进 `currentRank`。
- 推进 `currentPlayerId`。
- 增加 `turnSeq`。
- 如果该玩家手牌为 0，标记对局结束。

### 12.2 质疑

以下情况拒绝：

- 对局状态不是 `playing`。
- 当前没有 `lastPlay`。
- 质疑者就是上一手出牌者。
- 当前时机不允许质疑。

质疑成功处理：

- 判断上一手是否真实。
- 将整个弃牌堆移给失败方。
- 清空 `discardPile`。
- 清空 `lastPlay`。
- 根据规则设置下一位行动玩家。
- 增加 `turnSeq`。
- 只广播被质疑的上一手真实牌。

MVP 阶段建议将 `currentPlayerId` 设置为拿走牌堆的玩家。这个规则容易理解，节奏也清楚。

## 13. 安全与防作弊

必须做到：

- 不向其他玩家发送隐藏牌面。
- 客户端不能提交声明牌点，声明牌点由服务端根据 `currentRank` 决定。
- 服务端计算上一手真假。
- 服务端负责洗牌和发牌。
- 每个 Socket 事件都检查房间成员身份。
- 给每个玩家发送的公开状态必须按视角脱敏。

后续可选：

- 重连 token 签名。
- Socket 级别限流。
- 根据 `match_events` 做复盘审计。
- 服务端生成确定性洗牌 seed，并写入数据库。

## 14. 前端体验要求

MVP 的第一屏应该是传统游戏启动页，不要做营销落地页。启动页负责进入游戏、登录跳转、注册入口和基础设置，不展示长篇产品介绍。

设计方向：

- 卡桌布局，信息紧凑但清晰。
- 玩家座位和当前回合指示明显。
- 手牌尺寸要适合点击和选择。
- 操作按钮尺寸稳定，避免布局跳动。
- 事件日志简洁、可快速扫读。
- 发牌、出牌、质疑翻牌可以有简单动画，但不能拖慢核心操作。

预期控件：

- 手牌选择。
- 出牌按钮。
- 质疑按钮。
- 准备开关。
- 离开房间。
- 复制房间码。
- 启动页进入游戏按钮。
- 启动页音效开关。

## 15. MVP 里程碑

### Milestone 1：项目脚手架与账号系统

- 创建 `pnpm-workspace.yaml`。
- 初始化 `apps/web`，使用 `pnpm create next-app@latest apps/web --ts --use-pnpm`。
- 初始化 `apps/server`，使用 Fastify + TypeScript。
- 初始化 `packages/shared`。
- 添加 PostgreSQL、Redis、Prisma 基础配置。
- 本地开发直接连接本机或已有的 PostgreSQL / Redis 服务。
- 实现注册、登录、当前用户、退出登录 API。
- 实现前端注册页、登录页和登录态保护。
- 实现 Socket.IO token 鉴权。

### Milestone 2：本地游戏引擎

- 定义 card/rank/suit 类型。
- 实现创建牌堆和洗牌。
- 实现发牌。
- 实现出牌和质疑规则。
- 为真假判定、出牌校验、质疑结算添加单元测试。

### Milestone 3：实时游戏服务端

- 创建 Fastify 服务。
- 挂载 Socket.IO。
- 实现创建/加入/离开房间。
- 实现准备和开始游戏。
- 将活跃状态存入 Redis。
- 广播公开状态。

### Milestone 4：前端

- 实现传统游戏启动页。
- 实现大厅。
- 实现等待房间。
- 实现游戏桌面。
- 实现手牌选择。
- 实现出牌和质疑操作。
- 实现事件日志和胜利状态。

### Milestone 5：持久化

- 添加 PostgreSQL schema。
- 持久化房间和对局。
- 持久化对局事件。
- 持久化最终结果。

### Milestone 6：稳定性增强

- 支持断线重连。
- 登录用户重连 token。
- 服务端限流。
- 更清晰的错误提示。
- 基础部署配置。

## 16. 环境变量

开发者需要提前准备可连接的 PostgreSQL 和 Redis，可以是本机安装，也可以是远程开发服务。

```txt
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
GAME_SERVER_PORT=4000
NEXT_PUBLIC_GAME_SERVER_URL=http://localhost:4000
JWT_SECRET=replace-with-strong-secret
PASSWORD_HASH_SECRET=optional-extra-secret
NODE_ENV=development
```

## 17. 第一版不做的内容

除非后续明确要求，第一版不要实现：

- AI 对手。
- 排位匹配。
- 语音聊天。
- 付费和皮肤。
- 移动端 App 壳。
- 复杂锦标赛模式。
- 多套规则变体。
- 观战模式。
- 游客免登录模式。

## 18. 实现原则

- 服务端权威。
- 隐藏信息严格保密。
- 游戏引擎保持纯函数和可测试。
- Socket.IO handler 保持轻薄。
- Redis 负责热状态，PostgreSQL 负责长期历史。
- 使用小而明确的类型化事件，不要使用过大的非结构化 payload。
- 先测试游戏规则，再打磨 UI。
