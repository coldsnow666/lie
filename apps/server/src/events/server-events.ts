/**
 * 服务端 Socket 事件名：统一后端广播与前端监听的协议常量。
 */
export const SERVER_EVENTS = {
  LOBBY_ROOMS_UPDATED: "lobby:roomsUpdated",
  ROOM_UPDATED: "room:updated",
  GAME_UPDATED: "game:updated",
  GAME_EVENT: "game:event",
  GAME_CHALLENGE_RESOLVED: "game:challengeResolved",
  GAME_FINISHED: "game:finished",
  ERROR_MESSAGE: "error:message",
} as const;
