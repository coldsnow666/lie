/**
 * 文件说明：统一把公开游戏事件转换成房间页和对局页共用的中文文案。
 */
import type { PublicGameEvent } from "@lie/shared";

export function formatGameEvent(event: PublicGameEvent) {
  if (event.type === "room_joined") {
    return `${event.nickname} 进入房间`;
  }

  if (event.type === "room_left") {
    return `${event.nickname} 离开房间`;
  }

  if (event.type === "room_owner_changed") {
    return `${event.nickname} 成为房主`;
  }

  if (event.type === "player_connected") {
    return "玩家重新连接";
  }

  if (event.type === "player_disconnected") {
    return "玩家断开连接";
  }

  if (event.type === "cards_played") {
    return `玩家声明 ${event.declaredRank}，打出 ${event.cardCount} 张`;
  }

  if (event.type === "challenge_resolved") {
    return event.wasTruthful ? "质疑失败，质疑者拿走弃牌堆" : "质疑成功，上一手玩家拿走弃牌堆";
  }

  return "房间状态已更新";
}
