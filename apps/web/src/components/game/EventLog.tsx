/**
 * 事件日志组件：把公开游戏事件转换成玩家可读的中文文本。
 */
import type { PublicGameEvent } from "@lie/shared";
import PixelPanel from "@/components/ui/PixelPanel";

function describeEvent(event: PublicGameEvent) {
  if (event.type === "room_joined") {
    return `${event.nickname} 进入房间`;
  }

  if (event.type === "room_left") {
    return `${event.nickname} 离开房间`;
  }

  if (event.type === "room_owner_changed") {
    return `${event.nickname} 成为房主`;
  }

  if (event.type === "cards_played") {
    return `玩家打出 ${event.cardCount} 张，声明 ${event.declaredRank}`;
  }

  if (event.type === "challenge_resolved") {
    return event.wasTruthful ? "质疑失败，质疑者拿走弃牌堆" : "质疑成功，上一手玩家拿走弃牌堆";
  }

  return event.type === "player_connected" ? "玩家已连接" : "玩家断开连接";
}

export default function EventLog({ events }: { events: PublicGameEvent[] }) {
  return (
    <PixelPanel tone="dark" padding="md">
      <h2 className="mb-3 text-sm font-semibold text-[#fff6cf]">事件日志</h2>
      <div className="grid max-h-44 gap-2 overflow-y-auto text-sm text-[#c6b889]">
        {events.length ? (
          events
            .slice()
            .reverse()
            .map((event, index) => (
              <div key={`${event.type}-${index}`} className="border-2 border-[#32493d] bg-white/5 px-3 py-2">
                {describeEvent(event)}
              </div>
            ))
        ) : (
          <div className="border-2 border-[#32493d] bg-white/5 px-3 py-2">等待第一手牌。</div>
        )}
      </div>
    </PixelPanel>
  );
}
