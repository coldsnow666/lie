/**
 * 玩家座位组件：展示昵称、座位、连接状态、准备状态或剩余牌数。
 */
import { Crown, Wifi, WifiOff } from "lucide-react";
import PixelPanel from "@/components/ui/PixelPanel";

export type SeatPlayer = {
  playerId: string;
  userId?: string;
  nickname: string;
  seatIndex: number;
  connected: boolean;
  ready?: boolean;
  cardCount?: number;
  pendingWin?: boolean;
};

export default function PlayerSeat({
  player,
  active,
  owner,
}: {
  player: SeatPlayer;
  active?: boolean;
  owner?: boolean;
}) {
  return (
    <PixelPanel tone={active ? "highlight" : "dark"} padding="sm" className="min-w-0">
      <div className="flex min-w-0 items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[#fff6cf] sm:gap-2 sm:text-sm">
            {owner ? <Crown size={14} className="text-[#d7bc72]" /> : null}
            <span className="truncate">{player.nickname}</span>
          </div>
          <div className="mt-1 text-xs text-[#c6b889]">座位 {player.seatIndex + 1}</div>
        </div>
        {player.connected ? <Wifi size={16} className="shrink-0 text-emerald-300" /> : <WifiOff size={16} className="shrink-0 text-red-300" />}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[#c6b889] sm:mt-3">
        <span>
          {typeof player.cardCount === "number"
            ? player.pendingWin
              ? "待质疑"
              : `${player.cardCount} 张`
            : player.ready
              ? "已准备"
              : "等待中"}
        </span>
        {active ? <span className="shrink-0 text-[#f2df9e]">行动中</span> : null}
      </div>
    </PixelPanel>
  );
}
