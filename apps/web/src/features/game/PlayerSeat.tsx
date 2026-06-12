/**
 * @Description: 玩家座位组件：以牌背堆展示对手玩家的剩余手牌。
 *
 * @Date 2026-06-12 14:47
 */
import type { CSSProperties } from "react";
import { Crown } from "lucide-react";
import CardBackArt from "@/components/cards/CardBackArt";

export type SeatPlayer = {
  playerId: string;
  userId?: string;
  nickname: string;
  seatIndex: number;
  connected: boolean;
  ready?: boolean;
  cardCount?: number;
  cardBack?: number;
  pendingWin?: boolean;
};

export default function PlayerSeat({
  player,
  active,
  dealing,
  dealTargetCardCount,
  owner,
}: {
  player: SeatPlayer;
  active?: boolean;
  dealing?: boolean;
  dealTargetCardCount?: number;
  owner?: boolean;
}) {
  const cardCount = player.cardCount ?? 0;
  const renderedCardCount = Math.max(cardCount, dealTargetCardCount ?? 0);
  const visibleBacks = Array.from({ length: renderedCardCount });

  return (
    <div className="relative min-w-0 overflow-visible px-1 py-1">
      <div className="grid min-w-0 justify-items-center gap-2">
        <div className="flex min-w-0 max-w-full items-center gap-1.5 text-xs font-semibold text-[#fff6cf] sm:gap-2 sm:text-sm">
          {owner ? <Crown size={14} className="shrink-0 text-[#d7bc72]" /> : null}
          <span className="truncate">{player.nickname}</span>
        </div>
        <div className="lie-opponent-card-stack" aria-label={`${player.nickname} 剩余 ${cardCount} 张牌`}>
          {visibleBacks.map((_, index) => (
            <CardBackArt
              key={`${player.playerId}-back-${index}`}
              data-deal-target={dealing ? `${player.playerId}:${index}` : undefined}
              back={player.cardBack ?? 0}
              label={`${player.nickname} 的牌背`}
              className="lie-opponent-card-stack-card [--card-back-art-height:65px] [--card-back-art-width:49px] [--card-back-scale:1.55]"
              style={
                {
                  "--stack-card-x": `${index * 1.15}px`,
                  "--stack-card-y": `${index * -0.72}px`,
                  "--stack-card-rotate": `${-3.5 + (index % 6) * 0.72}deg`,
                  opacity: index < cardCount ? undefined : 0,
                  zIndex: index,
                } as CSSProperties
              }
            />
          ))}
          <div className="lie-opponent-card-count">{player.pendingWin ? "待质疑" : `${cardCount} 张`}</div>
        </div>
      </div>
      <div className="mt-2 flex min-h-4 items-center justify-center gap-2 text-xs text-[#c6b889]">
        {active ? <span className="shrink-0 text-[#f2df9e]">他的回合</span> : null}
        {!active && typeof player.cardCount !== "number" ? <span>{player.ready ? "已准备" : "等待中"}</span> : null}
      </div>
    </div>
  );
}
