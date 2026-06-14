/**
 * @Description: 玩家座位组件：以牌背堆展示对手玩家的剩余手牌。
 *
 * @Date 2026-06-12 14:47
 */
import type { CSSProperties } from "react";
import { Crown } from "lucide-react";
import CardBackArt from "@/components/cards/CardBackArt";

const MAX_VISIBLE_STACK_CARDS = 6;

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
  returnTargetCardCount,
}: {
  player: SeatPlayer;
  active?: boolean;
  dealing?: boolean;
  dealTargetCardCount?: number;
  owner?: boolean;
  returnTargetCardCount?: number;
}) {
  const cardCount = player.cardCount ?? 0;
  const renderedCardCount = Math.max(cardCount, dealTargetCardCount ?? 0);
  const placeholderBackCount = typeof player.cardCount === "number" ? 1 : 0;
  const visibleBackCount = Math.min(Math.max(cardCount, placeholderBackCount), MAX_VISIBLE_STACK_CARDS);
  const visibleBacks = Array.from({ length: visibleBackCount });
  const dealTargets = Array.from({ length: renderedCardCount });
  const returnTargets = Array.from({ length: returnTargetCardCount ?? 0 });
  const getStackPose = (index: number) => {
    const clampedIndex = Math.min(index, MAX_VISIBLE_STACK_CARDS - 1);

    return {
      x: clampedIndex * 1.35,
      y: clampedIndex * -0.86,
      rotate: -1.15 + (clampedIndex % 3) * 0.32,
    };
  };

  return (
    <div className="relative min-w-0 overflow-visible px-1 py-1">
      <div className="grid min-w-0 justify-items-center gap-2">
        <div className="flex min-w-0 max-w-full items-center gap-1.5 text-xs font-semibold text-[#fff6cf] sm:gap-2 sm:text-sm">
          {owner ? <Crown size={14} className="shrink-0 text-[#d7bc72]" /> : null}
          <span className="truncate">{player.nickname}</span>
        </div>
        <div className="lie-opponent-card-stack" data-dealing={dealing ? "true" : undefined} aria-label={`${player.nickname} 剩余 ${cardCount} 张牌`}>
          {visibleBacks.map((_, index) => {
            const pose = getStackPose(index);

            return (
              <CardBackArt
                key={`${player.playerId}-back-${index}`}
                back={player.cardBack ?? 0}
                label={`${player.nickname} 的牌背`}
                className="lie-opponent-card-stack-card [--card-back-art-height:65px] [--card-back-art-width:49px] [--card-back-scale:1.55]"
                style={
                  {
                    "--stack-card-x": `${pose.x}px`,
                    "--stack-card-y": `${pose.y}px`,
                    "--stack-card-rotate": `${pose.rotate}deg`,
                    zIndex: index,
                  } as CSSProperties
                }
              />
            );
          })}
          {dealing
            ? dealTargets.map((_, index) => {
                const pose = getStackPose(Math.min(index, MAX_VISIBLE_STACK_CARDS - 1));

                return (
                  <span
                    key={`${player.playerId}-deal-target-${index}`}
                    data-deal-target={`${player.playerId}:${index}`}
                    className="lie-opponent-deal-target"
                    style={
                      {
                        "--stack-card-x": `${pose.x}px`,
                        "--stack-card-y": `${pose.y}px`,
                        "--stack-card-rotate": `${pose.rotate}deg`,
                        zIndex: 40 + index,
                      } as CSSProperties
                    }
                  />
                );
              })
            : null}
          {returnTargets.map((_, index) => {
            const pose = getStackPose(Math.min(index, MAX_VISIBLE_STACK_CARDS - 1));

            return (
              <span
                key={`${player.playerId}-return-target-${index}`}
                data-return-target={`${player.playerId}:${index}`}
                className="lie-opponent-deal-target"
                style={
                  {
                    "--stack-card-x": `${pose.x}px`,
                    "--stack-card-y": `${pose.y}px`,
                    "--stack-card-rotate": `${pose.rotate}deg`,
                    zIndex: 60 + index,
                  } as CSSProperties
                }
              />
            );
          })}
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
