/**
 * 游戏桌面组件：展示玩家座位、目标牌点、弃牌堆、手牌和操作按钮。
 */
"use client";

import { DoorOpen, Swords, ThumbsDown } from "lucide-react";
import type { PublicGameEvent, PublicGameState } from "@lie/shared";
import PixelButton from "@/components/ui/PixelButton";
import PixelPanel from "@/components/ui/PixelPanel";
import EventLog from "./EventLog";
import Hand from "./Hand";
import PlayerSeat from "./PlayerSeat";

export default function GameTable({
  state,
  events,
  selectedCardIds,
  onToggleCard,
  onPlayCards,
  onChallenge,
  onLeave,
  busy,
}: {
  state: PublicGameState;
  events: PublicGameEvent[];
  selectedCardIds: string[];
  onToggleCard: (cardId: string) => void;
  onPlayCards: () => void;
  onChallenge: () => void;
  onLeave: () => void;
  busy: boolean;
}) {
  const winner = state.players.find((player) => player.playerId === state.winnerPlayerId);

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {state.players.map((player) => (
          <PlayerSeat key={player.playerId} player={player} active={player.playerId === state.currentPlayerId} />
        ))}
      </section>

      <PixelPanel tone="highlight" padding="md" className="shadow-xl shadow-black/25">
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <div className="flex min-h-64 flex-col items-center justify-center border-2 border-[#4e6e5c] bg-[radial-gradient(circle_at_center,#1f5d3d,#10271d_65%)] p-6 text-center">
            <div className="text-sm text-[#c6b889]">当前目标牌点</div>
            <div className="mt-2 text-7xl font-black text-[#fff6cf]">{state.currentRank}</div>
            <div className="mt-6 grid gap-2 text-sm text-[#f2df9e]">
              <span>弃牌堆 {state.discardPileCount} 张</span>
              {state.lastPlay ? (
                <span>
                  上一手声明 {state.lastPlay.declaredRank} x {state.lastPlay.declaredCount}
                </span>
              ) : (
                <span>暂无上一手</span>
              )}
            </div>
            {winner ? (
              <div className="mt-6 border-2 border-[#f6df8f] bg-[#d7bc72] px-4 py-2 font-bold text-[#102018]">胜者：{winner.nickname}</div>
            ) : null}
          </div>

          <EventLog events={events} />
        </div>
      </PixelPanel>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#fff6cf]">你的手牌</h2>
          <div className="flex gap-2">
            <PixelButton
              onClick={onPlayCards}
              disabled={busy || selectedCardIds.length < 1 || selectedCardIds.length > 4 || state.status === "finished"}
              variant="primary"
            >
              <Swords size={17} />
              打出所选
            </PixelButton>
            <PixelButton
              onClick={onChallenge}
              disabled={busy || !state.lastPlay || state.status === "finished"}
              variant="ghost"
            >
              <ThumbsDown size={17} />
              质疑
            </PixelButton>
            <PixelButton onClick={onLeave} disabled={busy} variant="danger">
              <DoorOpen size={17} />
              离开
            </PixelButton>
          </div>
        </div>
        <Hand cards={state.selfHand} selectedCardIds={selectedCardIds} onToggleCard={onToggleCard} />
      </section>
    </div>
  );
}
