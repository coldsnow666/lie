---
name: project-style
description: 统一 Web 游戏项目的代码风格、中文注释、目录结构、前后端接口约定、启动页交互、无 Docker 开发方式和验证流程。适用于继续开发或重构本仓库、添加接口、修改页面、处理登录态、调整动画、规范请求响应或整理项目结构。
---

# 唬牌项目风格

## 总原则

在本仓库开发时，始终把当前目录当作项目根目录，不要新建外层项目结构。优先遵循现有 monorepo：

```txt
apps/web
apps/server
packages/shared
```

使用 TypeScript。不要优先写 JavaScript。新增业务代码要结构清晰、命名稳定、职责单一，并尽量复用 `packages/shared` 中的类型、规则和 Zod schema。

不要加入 Docker 相关文件、命令或文档，本项目按本机 PostgreSQL、Redis、Node.js、pnpm 方式开发。

## 中文注释

每个手写源码、配置和样式文件都要在文件头使用中文块注释说明职责，统一写成：

```ts
/**
 * @Description: 说明这个文件负责什么。
 *
 * @Date 2026-06-12 14:47
 */
```

要求：

- 文件头注释放在 import、`"use client"`、配置对象或样式规则之前。
- 客户端组件的顺序是文件头注释、`"use client"`、import。
- `.ts`、`.tsx`、`.mjs`、`.css` 都使用 `/** ... */`。
- 生成文件和第三方产物不要加注释，例如 `apps/server/src/generated/prisma`。
- 只在复杂逻辑或容易误解的位置写中文注释，不写“定义变量”这类空注释。

复杂函数、Hook、服务方法和状态机，优先使用同一套 JSDoc 风格把参数和返回值也写清楚：

```ts
/**
 * @Description: 说明这个函数负责什么。
 *
 * @param foo 参数说明。
 * @param bar 参数说明。
 * @return 返回值说明；没有返回值就写“无”。
 *
 * @Date 2026-06-12 14:47
 */
```

必须写中文注释的位置：

- 服务端权威判定、隐藏信息脱敏、锁、事务、跨模块约定。
- 前端请求封装、登录态处理、Socket 连接鉴权、错误归一化。
- 游戏规则中容易误读的流程，例如质疑结算后谁继续行动。
- 临时兼容或 MVP 取舍，例如本地内存兜底、Redis 不可用兜底。

## 后端结构

新增后端模块时优先按下面结构拆分：

```txt
apps/server/src/
  <domain>/
    <domain>.routes.ts
    <domain>.service.ts
    <domain>.store.ts
  schemas/
    <domain>.schemas.ts
  events/
    client-events.ts
    server-events.ts
  utils/
    response.ts
```

约定：

- HTTP route 只做入参校验、调用 service、返回统一响应。
- service 放业务逻辑，不要把游戏规则直接写进 `socket.ts`。
- Socket handler 保持轻薄：校验 payload、校验 socket 用户、调用 service、广播脱敏状态。
- 服务端不要信任客户端提交的 `userId`、声明牌点或游戏状态。

## 后端响应

新增 HTTP API 前，确认存在统一响应工具：

```txt
apps/server/src/utils/response.ts
```

状态码和响应类型统一放在：

```txt
packages/shared/src/response.ts
```

强制约定：

- 新增响应码时，只能写进 `packages/shared/src/response.ts` 的公共码表，例如 `API_RESPONSE_CODE`。不要在 route、service、页面或请求封装里直接写 `40000`、`40101` 这类魔法数字。
- 前后端都从 `@lie/shared` 引用响应码、响应类型和错误码判断方法，不要各自维护一份。
- 所有 HTTP route 都必须通过 `sendOk` / `sendError` 返回响应，不要直接 `reply.code(...).send(...)` 手写响应体，除非是在维护统一响应工具本身。
- HTTP 响应体统一为 `code + data` 结构；前三位语义对齐 HTTP，后两位做业务细分。

推荐形状：

```ts
import { API_RESPONSE_CODE, type ApiResponseCode } from "@lie/shared";
import type { FastifyReply } from "fastify";

export type ApiErrorPayload = {
  code: ApiResponseCode;
  message: string;
};

export function sendOk<T>(reply: FastifyReply, data: T, code = API_RESPONSE_CODE.OK) {
  return reply.code(Math.trunc(code / 100)).send({
    code,
    data,
  });
}

export function sendError(reply: FastifyReply, error: ApiErrorPayload) {
  return reply.code(Math.trunc(error.code / 100)).send({
    code: error.code,
    data: {
      message: error.message,
    },
  });
}
```

route 中推荐写法：

```ts
return sendOk(reply, { user });
return sendError(reply, {
  code: API_RESPONSE_CODE.UNAUTHORIZED,
  message: "请先登录",
});
```

不要在不同 route 中混用 `{ user }`、`{ ok: true }`、`{ error }` 等多种响应形状。若要兼容旧接口，在迁移点写中文注释说明。

## 前端请求

新增 REST 请求前，确认 `apps/web/src/service/` 中有统一请求目录。推荐结构：

```txt
apps/web/src/service/
  modules/
    user.ts
    game.ts
  index.ts
```

约定：

- `apps/web/src/service/index.ts` 负责统一请求封装，例如鉴权头、公共错误处理和 `code + data` 协议解析。
- `apps/web/src/service/modules/*.ts` 按领域拆分请求，例如 `user.ts` 放登录态相关请求，`game.ts` 放房间和游戏相关请求。
- 页面、组件、hooks 和其他前端业务代码必须优先引用 `@/service/modules/<domain>` 下的模块方法，不要直接引用底层 `request()`，也不要把请求重新写回 `lib/`。
- 如果新增请求不适合放进现有模块，必须在 `apps/web/src/service/modules/` 下新增对应模块，不要把不相关请求硬塞进 `user.ts` 或 `game.ts`。
- 所有页面组件都调用语义化方法，例如 `login()`、`fetchMe()`、`createRoom()`，不要直接写裸 `fetch`。

推荐形状：

```ts
import {
  API_RESPONSE_CODE,
  isErrorResponseCode,
  type ApiEnvelope,
  type ApiErrorData,
  type ApiResponseCode,
} from "@lie/shared";

export class ApiRequestError extends Error {
  code: ApiResponseCode;

  constructor(code: ApiResponseCode, message: string) {
    super(message);
    this.code = code;
  }
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...options.headers,
    },
  });

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null;

  if (!payload) {
    throw new Error("请求失败");
  }

  if (isErrorResponseCode(payload.code) || !response.ok) {
    const errorData = payload.data as ApiErrorData;
    throw new ApiRequestError(payload.code ?? API_RESPONSE_CODE.UNKNOWN_ERROR, errorData.message ?? "请求失败");
  }

  return payload.data as T;
}
```

退出登录要本地态优先：服务端退出失败、token 失效或接口不可用时，也要清理本地登录态，避免用户被卡住。

## 前后端接口流程

新增接口按顺序做：

1. 在 `packages/shared/src/schemas.ts` 定义或复用 Zod schema。
2. 在后端 route 中使用 schema 校验输入。
3. 在后端 service 中处理业务。
4. 如果需要新增响应码，先改 `packages/shared/src/response.ts`，再在前后端引用公共常量。
5. 用统一响应方法返回结果，不直接手写 HTTP 响应体。
6. 在 `apps/web/src/service/modules/` 中按领域定义语义化请求方法，由 `apps/web/src/service/index.ts` 提供统一请求封装；如果现有模块不适合，先新增模块，再落请求，不在页面里直接写 `fetch`。
7. 页面组件调用请求方法，不直接拼 URL 或处理底层响应结构。
8. 跑 `pnpm test`、`pnpm lint`、`pnpm build`。

## 前端页面

页面和组件遵循现有视觉系统，不要引入无关 landing page。启动页就是可用入口，不做营销式首屏。

全局约定：

- `Balatro.tsx` 作为所有页面的全局背景，不要在单个页面重复挂载。
- 项目里不要出现 header 顶部栏或品牌栏。
- 不允许任何元素造成 body 横向溢出。
- 固定格式 UI 要有稳定尺寸和响应式约束，避免 hover、动画、文案变化导致布局跳动。
- 启动页按钮区横向居中，纵向靠近底部并保留底部距离。
- 启动页卡片区在按钮区上方剩余空间中居中，卡片动画不能遮盖按钮，也不能被自身裁剪盒切掉。

启动页动画约定：

- 启动页卡片使用 ReactBits 风格的 Bounce Cards 效果。
- 四张牌显示 `L`、`I`、`A`、`R`，花色分别为黑桃、红心、方块、梅花。
- 启动页进入和退出使用同一套动画时间线；进入时反向播放，退出时正向播放。
- 退出启动页时，`L` 飞向左上角，`I` 飞向右上角，`A` 飞向左下角，`R` 飞向右下角；飞出后按钮区向下退出，再执行路由跳转。
- 动画逻辑要封装在独立 hook 或组件中，不要散落在按钮点击逻辑里。
- 登录表单从上方进入，动画只作用在表单容器，不影响请求逻辑。

## 登录态

启动页未登录时主按钮显示“登录”，点击进入登录页；已登录时显示“进入游戏”，点击进入大厅。启动页“退出”只清理本地登录态并把启动页状态改回未登录，不跳转登录页。

大厅、房间等受保护页面继续由 `AuthGuard` 或服务端鉴权兜底，启动页本地判断只用于入口文案和跳转方向。

## 验证流程

完成改动后报告验证结果。按风险选择验证范围：

- 前端组件或页面改动：至少跑 `pnpm --filter @lie/web lint`。
- 影响构建、路由、类型或共享包：跑 `pnpm --filter @lie/web build`。
- 影响共享规则或后端：跑 `pnpm lint`、`pnpm test`。
- 视觉和响应式改动：用浏览器检查桌面和手机视口，确认无 header、无横向溢出、背景 canvas 存在、关键元素没有遮挡或裁剪。

如果数据库、Redis 或本地服务不可用，要明确说明不可用原因。
