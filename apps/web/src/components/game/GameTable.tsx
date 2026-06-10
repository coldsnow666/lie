/**
 * 游戏桌面组件：展示玩家座位、上一手声明、弃牌堆、手牌和操作按钮。
 */
"use client";

import { DECLARABLE_RANKS, type DeclaredRank } from "@lie/shared";
import { DoorOpen, Swords, ThumbsDown } from "lucide-react";
import type { PublicGameEvent, PublicGameState } from "@lie/shared";
import PixelButton from "@/components/ui/PixelButton";
import PixelPanel from "@/components/ui/PixelPanel";
import PixelSelect from "@/components/ui/PixelSelect";
import EventLog from "./EventLog";
import Hand from "./Hand";
import PlayerSeat from "./PlayerSeat";

export default function GameTable({
  state,
  events,
  selectedCardIds,
  declaredRank,
  onDeclaredRankChange,
  onToggleCard,
  onPlayCards,
  onChallenge,
  onLeave,
  busy,
}: {
  state: PublicGameState;
  events: PublicGameEvent[];
  selectedCardIds: string[];
  declaredRank: DeclaredRank;
  onDeclaredRankChange: (rank: DeclaredRank) => void;
  onToggleCard: (cardId: string) => void;
  onPlayCards: () => void;
  onChallenge: () => void;
  onLeave: () => void;
  busy: boolean;
}) {
  const winner = state.players.find((player) => player.playerId === state.winnerPlayerId);
  const pendingWinner = state.players.find((player) => player.pendingWin) ?? null;
  const resolvingPendingWin = Boolean(pendingWinner && state.lastPlay && pendingWinner.playerId !== state.currentPlayerId);

  return (
    <div className="grid gap-3 px-3 py-3 sm:gap-5 sm:px-4 sm:py-5 xl:px-1">
      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        {state.players.map((player) => (
          <PlayerSeat key={player.playerId} player={player} active={player.playerId === state.currentPlayerId} />
        ))}
      </section>

      <PixelPanel tone="highlight" padding="sm" className="shadow-xl shadow-black/25 sm:p-4">
        <div className="grid gap-3 sm:gap-5 lg:grid-cols-[1fr_280px]">
          <div className="flex min-h-40 flex-col items-center justify-center border-2 border-[#4e6e5c] bg-[radial-gradient(circle_at_center,#1f5d3d,#10271d_65%)] p-4 text-center sm:min-h-64 sm:p-6">
            <div className="text-xs text-[#c6b889] sm:text-sm">本局规则</div>
            <div className="mt-1 text-2xl font-black text-[#fff6cf] sm:mt-2 sm:text-3xl">自由声明牌点</div>
            <div className="mt-4 grid gap-1.5 text-xs text-[#f2df9e] sm:mt-6 sm:gap-2 sm:text-sm">
              <span>弃牌堆 {state.discardPileCount} 张</span>
              {state.lastPlay ? (
                <span>
                  上一手声明 {state.lastPlay.declaredRank} x {state.lastPlay.cardCount}
                </span>
              ) : (
                <span>暂无上一手</span>
              )}
              {pendingWinner ? <span>{pendingWinner.nickname} 已出完手牌，等待质疑结算</span> : null}
            </div>
            {winner ? (
              <div className="mt-4 border-2 border-[#f6df8f] bg-[#d7bc72] px-4 py-2 font-bold text-[#102018] sm:mt-6">胜者：{winner.nickname}</div>
            ) : null}
          </div>

          <EventLog events={events} />
        </div>
      </PixelPanel>

      <section className="grid gap-3">
        <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-[#fff6cf]">你的手牌</h2>
          <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
            <PixelSelect
              value={declaredRank}
              onChange={(event) => onDeclaredRankChange(event.target.value as DeclaredRank)}
              disabled={busy || resolvingPendingWin || state.status === "finished"}
              aria-label="声明牌点"
              className="col-span-2 min-w-0 sm:min-w-[9rem]"
              selectClassName="text-sm font-bold tracking-[0.12em]"
            >
              {DECLARABLE_RANKS.map((rank) => (
                <option key={rank} value={rank}>
                  声明 {rank}
                </option>
              ))}
            </PixelSelect>
            <PixelButton
              onClick={onPlayCards}
              disabled={
                busy ||
                state.status === "finished" ||
                (!resolvingPendingWin && (selectedCardIds.length < 1 || selectedCardIds.length > 4))
              }
              variant="primary"
              className="col-span-2 w-full sm:w-auto"
            >
              <Swords size={17} />
              {resolvingPendingWin ? "不质疑，确认获胜" : "打出所选"}
            </PixelButton>
            <PixelButton
              onClick={onChallenge}
              disabled={busy || !state.lastPlay || state.status === "finished"}
              variant="ghost"
              className="w-full sm:w-auto"
            >
              <ThumbsDown size={17} />
              质疑
            </PixelButton>
            <PixelButton onClick={onLeave} disabled={busy} variant="danger" className="w-full sm:w-auto">
              <DoorOpen size={17} />
              离开
            </PixelButton>
          </div>
        </div>
        {resolvingPendingWin ? (
          <p className="text-sm text-[#c6b889]">上一手玩家已打空手牌。你可以质疑；如果不质疑，点击主按钮会直接确认其获胜。</p>
        ) : null}
        <Hand cards={state.selfHand} selectedCardIds={selectedCardIds} onToggleCard={onToggleCard} />
      </section>
    </div>
  );
}
