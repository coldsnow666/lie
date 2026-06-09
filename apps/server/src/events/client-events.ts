/**
 * 客户端 Socket 事件名：统一前端 emit 与后端监听的协议常量。
 */
export const CLIENT_EVENTS = {
  ROOM_CREATE: "room:create",
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",
  ROOM_READY: "room:ready",
  GAME_START: "game:start",
  GAME_PLAY_CARDS: "game:playCards",
  GAME_CHALLENGE: "game:challenge",
  GAME_SYNC: "game:sync",
} as const;
