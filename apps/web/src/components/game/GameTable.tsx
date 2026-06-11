/**
 * 游戏桌面组件：展示对手牌背堆、弃牌堆、手牌和操作按钮，并承载发牌/出牌动画。
 */
"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { DECLARABLE_RANKS, type DeclaredRank } from "@lie/shared";
import { Swords, ThumbsDown } from "lucide-react";
import type { PublicGameState } from "@lie/shared";
import PixelButton from "@/components/ui/PixelButton";
import PixelModal from "@/components/ui/PixelModal";
import CardBackArt from "./CardBackArt";
import DomPlayingCard from "./DomPlayingCard";
import Hand from "./Hand";
import PlayerSeat from "./PlayerSeat";

type GamePlayer = PublicGameState["players"][number];
type PublicDiscardCard = PublicGameState["discardPileCards"][number];
type VisibleCardCounts = Record<string, number>;
type ReturnFlightCard = {
  id: string;
  cardBack: number;
  index: number;
  startX: number;
  startY: number;
  startRotate: number;
  targetX: number;
  targetY: string;
  targetRotate: number;
};
function getTargetCardCounts(players: GamePlayer[]) {
  return Object.fromEntries(players.map((player) => [player.playerId, player.cardCount])) as VisibleCardCounts;
}

function useDealAnimation(state: PublicGameState) {
  const [visibleCardCounts, setVisibleCardCounts] = useState<VisibleCardCounts>(() => getTargetCardCounts(state.players));
  const [dealing, setDealing] = useState(false);
  const animatedMatchIdRef = useRef<string | null>(null);

  useEffect(() => {
    const targetCounts = getTargetCardCounts(state.players);
    const shouldDeal =
      state.status === "playing" &&
      state.turnSeq === 1 &&
      state.discardPileCount === 0 &&
      animatedMatchIdRef.current !== state.matchId;

    if (!shouldDeal) {
      setDealing(false);
      setVisibleCardCounts(targetCounts);
      return;
    }

    animatedMatchIdRef.current = state.matchId;
    setDealing(true);

    const players = [...state.players].sort((left, right) => left.seatIndex - right.seatIndex);
    const maxCards = Math.max(...players.map((player) => player.cardCount), 0);
    const dealSequence = Array.from({ length: maxCards }).flatMap((_, cardIndex) =>
      players.filter((player) => cardIndex < player.cardCount).map((player) => player.playerId),
    );

    setVisibleCardCounts(Object.fromEntries(players.map((player) => [player.playerId, 0])) as VisibleCardCounts);

    let dealIndex = 0;
    const timer = window.setInterval(() => {
      const playerId = dealSequence[dealIndex];

      if (!playerId) {
        window.clearInterval(timer);
        setVisibleCardCounts(targetCounts);
        setDealing(false);
        return;
      }

      setVisibleCardCounts((current) => ({
        ...current,
        [playerId]: Math.min((current[playerId] ?? 0) + 1, targetCounts[playerId] ?? 0),
      }));
      dealIndex += 1;
    }, 78);

    return () => window.clearInterval(timer);
  }, [state.discardPileCount, state.matchId, state.players, state.status, state.turnSeq]);

  return { visibleCardCounts, dealing };
}

function getDiscardCardPose(index: number) {
  const x = ((index * 17) % 39) - 19;
  const y = ((index * 11) % 31) - 15;
  const rotate = ((index * 23) % 38) - 19;

  return { x, y, rotate };
}

function getDiscardFlightStart(card: PublicDiscardCard, players: GamePlayer[], selfPlayerId?: string | null) {
  if (card.playedByPlayerId === selfPlayerId) {
    return { x: 0, y: "20rem", rotate: -10 };
  }

  const opponents = players
    .filter((player) => player.playerId !== selfPlayerId)
    .sort((left, right) => left.seatIndex - right.seatIndex);
  const opponentIndex = Math.max(0, opponents.findIndex((player) => player.playerId === card.playedByPlayerId));

  return {
    x: opponentIndex === 0 ? -140 : 140,
    y: "-15rem",
    rotate: opponentIndex === 0 ? -9 : 9,
  };
}

function getPlayerFlightTarget(playerId: string, players: GamePlayer[], selfPlayerId?: string | null) {
  if (playerId === selfPlayerId) {
    return { x: 0, y: "20rem", rotate: -8 };
  }

  const opponents = players
    .filter((player) => player.playerId !== selfPlayerId)
    .sort((left, right) => left.seatIndex - right.seatIndex);
  const opponentIndex = Math.max(0, opponents.findIndex((player) => player.playerId === playerId));

  return {
    x: opponentIndex === 0 ? -140 : 140,
    y: "-15rem",
    rotate: opponentIndex === 0 ? -9 : 9,
  };
}

function DiscardPile({
  cards,
  players,
  selfPlayerId,
}: {
  cards: PublicDiscardCard[];
  players: GamePlayer[];
  selfPlayerId?: string | null;
}) {
  const visibleCards = cards.slice(-48);

  return (
    <div className="lie-discard-pile" aria-label={`弃牌堆 ${cards.length} 张`}>
      {visibleCards.map((card, index) => {
        const pose = getDiscardCardPose(cards.length - visibleCards.length + index);
        const flightStart = getDiscardFlightStart(card, players, selfPlayerId);

        return (
          <CardBackArt
            key={`${card.turnSeq}-${card.playedByPlayerId}-${index}`}
            back={card.cardBack}
            label="弃牌堆中的牌背"
            className="lie-discard-pile-card [--card-back-art-height:65px] [--card-back-art-width:49px] [--card-back-scale:1.55]"
            style={
              {
                "--discard-card-x": `${pose.x}px`,
                "--discard-card-y": `${pose.y}px`,
                "--discard-card-rotate": `${pose.rotate}deg`,
                "--discard-card-start-x": `${flightStart.x + (index % 4) * 10 - 15}px`,
                "--discard-card-from-y": flightStart.y,
                "--discard-card-from-rotate": `${flightStart.rotate}deg`,
                animationDelay: `${(index % 4) * 45}ms`,
                animationName: card.playedByPlayerId === selfPlayerId ? "lie-discard-card-from-self" : "lie-discard-card-from-opponent",
                zIndex: index,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

function ReturnFlightLayer({ cards }: { cards: ReturnFlightCard[] }) {
  return (
    <div className="lie-return-flight-layer" aria-hidden>
      {cards.map((card) => (
        <CardBackArt
          key={card.id}
          back={card.cardBack}
          label="飞回手牌的牌背"
          className="lie-return-flight-card [--card-back-art-height:65px] [--card-back-art-width:49px] [--card-back-scale:1.55]"
          style={
            {
              "--return-card-start-x": `${card.startX}px`,
              "--return-card-start-y": `${card.startY}px`,
              "--return-card-start-rotate": `${card.startRotate}deg`,
              "--return-card-target-x": `${card.targetX + (card.index % 5) * 6 - 12}px`,
              "--return-card-target-y": card.targetY,
              "--return-card-target-rotate": `${card.targetRotate}deg`,
              animationDelay: `${card.index * 24}ms`,
              zIndex: card.index,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export default function GameTable({
  state,
  selectedCardIds,
  ownerUserId,
  selfPlayerId,
  onDeclaredRankChange,
  onToggleCard,
  onSetCardSelected,
  onPlayCards,
  onChallenge,
  busy,
}: {
  state: PublicGameState;
  selectedCardIds: string[];
  ownerUserId?: string | null;
  selfPlayerId?: string | null;
  onDeclaredRankChange: (rank: DeclaredRank) => void;
  onToggleCard: (cardId: string) => void;
  onSetCardSelected: (cardId: string, selected: boolean) => void;
  onPlayCards: (declaredRank?: DeclaredRank) => void;
  onChallenge: () => void;
  busy: boolean;
}) {
  const pendingWinner = state.players.find((player) => player.pendingWin) ?? null;
  const resolvingPendingWin = Boolean(pendingWinner && state.lastPlay && pendingWinner.playerId !== state.currentPlayerId);
  const { visibleCardCounts, dealing } = useDealAnimation(state);
  const [declareModalOpen, setDeclareModalOpen] = useState(false);
  const [returnFlights, setReturnFlights] = useState<ReturnFlightCard[]>([]);
  const previousDiscardCardsRef = useRef<PublicDiscardCard[]>(state.discardPileCards);
  const opponents = useMemo(
    () => [...state.players].sort((left, right) => left.seatIndex - right.seatIndex).filter((player) => player.playerId !== selfPlayerId),
    [selfPlayerId, state.players],
  );
  const selfVisibleCardCount = selfPlayerId ? (visibleCardCounts[selfPlayerId] ?? state.selfHand.length) : state.selfHand.length;
  const visibleSelfHand = dealing ? state.selfHand.slice(0, selfVisibleCardCount) : state.selfHand;

  useEffect(() => {
    const previousDiscardCards = previousDiscardCardsRef.current;
    previousDiscardCardsRef.current = state.discardPileCards;

    if (!previousDiscardCards.length || state.discardPileCards.length) {
      return;
    }

    const target = getPlayerFlightTarget(state.currentPlayerId, state.players, selfPlayerId);
    const nextFlights = previousDiscardCards.slice(-48).map((card, index, visibleCards) => {
      const absoluteIndex = previousDiscardCards.length - visibleCards.length + index;
      const pose = getDiscardCardPose(absoluteIndex);

      return {
        id: `${state.turnSeq}-${card.playedByPlayerId}-${index}-${Date.now()}`,
        cardBack: card.cardBack,
        index,
        startX: pose.x,
        startY: pose.y,
        startRotate: pose.rotate,
        targetX: target.x,
        targetY: target.y,
        targetRotate: target.rotate,
      };
    });

    const startTimer = window.setTimeout(() => {
      setReturnFlights((current) => [...current, ...nextFlights]);
    }, 0);
    const endTimer = window.setTimeout(
      () => {
        setReturnFlights((current) => current.filter((card) => !nextFlights.some((flight) => flight.id === card.id)));
      },
      760 + nextFlights.length * 24,
    );

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(endTimer);
    };
  }, [selfPlayerId, state.currentPlayerId, state.discardPileCards, state.players, state.turnSeq]);

  function handlePlayButtonClick() {
    if (resolvingPendingWin) {
      onPlayCards();
      return;
    }

    setDeclareModalOpen(true);
  }

  function handleDeclaredRank(rank: DeclaredRank) {
    onDeclaredRankChange(rank);
    setDeclareModalOpen(false);
    onPlayCards(rank);
  }

  return (
    <div className="lie-game-table relative grid gap-3 overflow-visible px-3 py-3 sm:gap-5 sm:px-4 sm:py-5 xl:px-1">
      <section className="grid grid-cols-2 gap-2 sm:gap-3">
        {opponents.map((player) => (
          <PlayerSeat
            key={player.playerId}
            player={{
              ...player,
              cardCount: dealing ? (visibleCardCounts[player.playerId] ?? 0) : player.cardCount,
            }}
            active={player.playerId === state.currentPlayerId}
            owner={Boolean(ownerUserId && player.userId === ownerUserId)}
          />
        ))}
      </section>

      <div className="lie-table-surface">
        <DiscardPile cards={state.discardPileCards} players={state.players} selfPlayerId={selfPlayerId} />
        <ReturnFlightLayer cards={returnFlights} />
      </div>

      <section className="grid gap-3">
        <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="grid w-full max-w-[16rem] gap-2 sm:w-auto">
            <PixelButton
              onClick={handlePlayButtonClick}
              disabled={
                busy ||
                dealing ||
                state.status === "finished" ||
                (!resolvingPendingWin && (selectedCardIds.length < 1 || selectedCardIds.length > 4))
              }
              variant="primary"
              className="w-full"
            >
              <Swords size={17} />
              {resolvingPendingWin ? "不质疑，确认获胜" : "出牌"}
            </PixelButton>
            <PixelButton
              onClick={onChallenge}
              disabled={busy || dealing || !state.lastPlay || state.status === "finished"}
              variant="ghost"
              className="w-full"
            >
              <ThumbsDown size={17} />
              质疑
            </PixelButton>
          </div>
        </div>
        {resolvingPendingWin ? (
          <p className="text-sm text-[#c6b889]">上一手玩家已打空手牌。你可以质疑；如果不质疑，点击主按钮会直接确认其获胜。</p>
        ) : null}
        <Hand
          cards={visibleSelfHand}
          dealing={dealing}
          selectedCardIds={selectedCardIds}
          onToggleCard={onToggleCard}
          onSetCardSelected={onSetCardSelected}
        />
      </section>

      {declareModalOpen ? (
        <PixelModal title="声明点数" onClose={() => setDeclareModalOpen(false)} className="max-w-[min(44rem,100%)]">
          <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(4.7rem,1fr))] gap-3">
            {DECLARABLE_RANKS.map((rank) => (
              <button
                key={rank}
                type="button"
                className="grid place-items-center bg-transparent p-0 transition-transform hover:scale-105 focus-visible:scale-105 focus-visible:outline-none"
                onClick={() => handleDeclaredRank(rank)}
              >
                <DomPlayingCard card={{ id: `${rank}H`, rank, suit: "H" }} className="[--pixel-card-scale:1.35]" />
              </button>
            ))}
          </div>
        </PixelModal>
      ) : null}
    </div>
  );
}
