/**
 * 事件日志组件：把公开游戏事件转换成玩家可读的中文文本。
 */
import type { PublicGameEvent } from "@lie/shared";
import PixelPanel from "@/components/ui/PixelPanel";
import { formatGameEvent } from "./formatGameEvent";

export default function EventLog({ events }: { events: PublicGameEvent[] }) {
  return (
    <PixelPanel tone="dark" padding="sm" className="sm:p-4">
      <h2 className="mb-2 text-sm font-semibold text-[#fff6cf] sm:mb-3">事件日志</h2>
      <div className="grid max-h-28 gap-2 overflow-y-auto text-xs text-[#c6b889] sm:max-h-44 sm:text-sm">
        {events.length ? (
          events
            .slice()
            .reverse()
            .map((event, index) => (
              <div key={`${event.type}-${index}`} className="border-2 border-[#32493d] bg-white/5 px-2.5 py-1.5 sm:px-3 sm:py-2">
                {formatGameEvent(event)}
              </div>
            ))
        ) : (
          <div className="border-2 border-[#32493d] bg-white/5 px-2.5 py-1.5 sm:px-3 sm:py-2">等待第一手牌。</div>
        )}
      </div>
    </PixelPanel>
  );
}
