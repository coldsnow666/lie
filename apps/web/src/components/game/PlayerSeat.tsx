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
    <PixelPanel tone={active ? "highlight" : "dark"} padding="sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#fff6cf]">
            {owner ? <Crown size={14} className="text-[#d7bc72]" /> : null}
            {player.nickname}
          </div>
          <div className="mt-1 text-xs text-[#c6b889]">座位 {player.seatIndex + 1}</div>
        </div>
        {player.connected ? <Wifi size={16} className="text-emerald-300" /> : <WifiOff size={16} className="text-red-300" />}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-[#c6b889]">
        <span>
          {typeof player.cardCount === "number"
            ? player.pendingWin
              ? "待质疑"
              : `${player.cardCount} 张`
            : player.ready
              ? "已准备"
              : "等待中"}
        </span>
        {active ? <span className="text-[#f2df9e]">行动中</span> : null}
      </div>
    </PixelPanel>
  );
}
