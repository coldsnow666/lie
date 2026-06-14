/**
 * @Description: 客户端 Socket 事件名：统一前端 emit 与后端监听的协议常量。
 *
 * @Date 2026-06-12 14:47
 */
export const CLIENT_EVENTS = {
  LOBBY_SUBSCRIBE: "lobby:subscribe",
  LOBBY_UNSUBSCRIBE: "lobby:unsubscribe",
  ROOM_CREATE: "room:create",
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",
  ROOM_READY: "room:ready",
  GAME_START: "game:start",
  GAME_PLAY_CARDS: "game:playCards",
  GAME_SKIP_TURN: "game:skipTurn",
  GAME_CHALLENGE: "game:challenge",
  GAME_SYNC: "game:sync",
} as const;
