/**
 * @Description: 游戏桌面组件：组合对手座位、弃牌区、手牌、发牌动画和出牌/质疑操作入口。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { DECLARABLE_RANKS, isJokerRank, type DeclaredRank } from "@lie/shared";
import type { PublicGameEvent, PublicGameState } from "@lie/shared";
import PixelButton from "@/components/ui/PixelButton";
import PixelModal from "@/components/ui/PixelModal";
import DomPlayingCard from "@/components/cards/DomPlayingCard";
import Hand from "../hand/Hand";
import { groupHandCards } from "../hand/handLayout";
import PlayerSeat from "./PlayerSeat";
import DealFlightLayer from "../animation/DealFlightLayer";
import DiscardPile from "../discard/DiscardPile";
import { getScatteredDiscardPose } from "../discard/discardLayout";
import PlayFlightLayer, { measurePlayFlightCards } from "../animation/PlayFlightLayer";
import ReturnFlightLayer from "../animation/ReturnFlightLayer";
import { TableCenterNotice, TableStatusPanel } from "./TableCenterNotice";
import {
  CHALLENGE_ANNOUNCE_HOLD_SECONDS,
  CHALLENGE_RESULT_HOLD_SECONDS,
} from "../model/gameTableConstants";
import { getDeclareRankCardLayout } from "../model/declareRankLayout";
import { getLatestChallengeResolvedEvent, revealDiscardCards, revealReturnFlights } from "../discard/challengeReveal";
import { getDealHandCards, useDealAnimation } from "../animation/useDealAnimation";
import type { ChallengeReturnPlan, PlayFlightCard, ReturnFlightCard, ReturnTargetPlan } from "../model/gameTableTypes";
import ChallengeOverlay from "./ChallengeOverlay";

const TURN_COUNTDOWN_SECONDS = 30;

/**
 * @Description: 组合牌桌 UI、发牌动画、弃牌动画和出牌/质疑操作入口。
 *
 * @param state 当前玩家视角的公开游戏状态。
 * @param events 房间事件流。
 * @param selectedCardIds 当前选中的手牌 ID。
 * @param ownerUserId 房主用户 ID。
 * @param selfPlayerId 当前玩家 ID。
 * @param onDeclaredRankChange 声明牌点变更回调。
 * @param onToggleCard 单张手牌切换回调。
 * @param onSetCardSelected 拖选手牌时的定向选中回调。
 * @param onPlayCards 出牌或确认待定胜利回调，可传入与动画一致的出牌顺序。
 * @param onChallenge 质疑回调。
 * @param onSkipTurn 跳过当前回合回调。
 * @param busy 当前房间操作是否正在提交。
 * @return 游戏牌桌组件。
 *
 * @Date 2026-06-12 14:47
 */
export default function GameTable({
  state,
  events,
  selectedCardIds,
  ownerUserId,
  selfPlayerId,
  onDeclaredRankChange,
  onToggleCard,
  onSetCardSelected,
  onPlayCards,
  onChallenge,
  onSkipTurn,
  busy,
}: {
  state: PublicGameState;
  events: PublicGameEvent[];
  selectedCardIds: string[];
  ownerUserId?: string | null;
  selfPlayerId?: string | null;
  onDeclaredRankChange: (rank: DeclaredRank) => void;
  onToggleCard: (cardId: string) => void;
  onSetCardSelected: (cardId: string, selected: boolean) => void;
  onPlayCards: (declaredRank?: DeclaredRank, orderedCardIds?: string[]) => void;
  onChallenge: () => void;
  onSkipTurn: () => void;
  busy: boolean;
}) {
  const pendingWinner = state.players.find((player) => player.pendingWin) ?? null;
  const resolvingPendingWin = Boolean(pendingWinner && state.lastPlay && pendingWinner.playerId !== state.currentPlayerId);
  const isSelfTurn = Boolean(selfPlayerId && state.currentPlayerId === selfPlayerId);
  const followRank = resolvingPendingWin ? null : (state.lastPlay?.declaredRank ?? null);
  const canChallenge = Boolean(isSelfTurn && state.lastPlay && state.lastPlay.playerId !== selfPlayerId && state.status !== "finished");
  const canPlay = Boolean(isSelfTurn && state.status !== "finished");
  const {
    completeDealFlight,
    dealFlights,
    dealing,
    remainingDeckCount,
    selfDealCards,
    visibleCardCounts,
  } = useDealAnimation(state, selfPlayerId);
  const [declareModalOpen, setDeclareModalOpen] = useState(false);
  const [declareRankCardLayout, setDeclareRankCardLayout] = useState(() => ({ columns: 5, scale: 1.12 }));
  const countdownKey = `${state.turnSeq}:${state.turnDeadlineAt ?? "none"}`;
  const [serverNowState, setServerNowState] = useState(() => ({
    key: countdownKey,
    now: Date.now(),
  }));
  const [returnFlights, setReturnFlights] = useState<ReturnFlightCard[]>([]);
  const [returnTargetPlan, setReturnTargetPlan] = useState<ReturnTargetPlan | null>(null);
  const [playFlightCards, setPlayFlightCards] = useState<PlayFlightCard[]>([]);
  const [outgoingPlayCardIds, setOutgoingPlayCardIds] = useState<string[]>([]);
  const returnFlightsRef = useRef<ReturnFlightCard[]>([]);
  const pendingPlayDeclaredRankRef = useRef<DeclaredRank | undefined>(undefined);
  const pendingPlayCardIdsRef = useRef<string[] | undefined>(undefined);
  const completedReturnFlightIdsRef = useRef(new Set<string>());
  const lastDiscardSnapshotRef = useRef({
    cards: state.discardPileCards,
    selfHand: state.selfHand,
  });
  const [challengeReturnPlan, setChallengeReturnPlan] = useState<ChallengeReturnPlan | null>(null);
  const eventsRef = useRef(events);
  const processedReturnTurnSeqRef = useRef<number | null>(null);
  const startedReturnTurnSeqRef = useRef<number | null>(null);
  const opponents = useMemo(
    () => [...state.players].sort((left, right) => left.seatIndex - right.seatIndex).filter((player) => player.playerId !== selfPlayerId),
    [selfPlayerId, state.players],
  );
  const dealPresentationActive = dealing || dealFlights.length > 0;
  const selfVisibleCardCount = selfPlayerId ? (visibleCardCounts[selfPlayerId] ?? (dealPresentationActive ? 0 : state.selfHand.length)) : dealPresentationActive ? 0 : state.selfHand.length;
  const { dealTargetSelfHand, visibleSelfHand } = getDealHandCards({
    dealing: dealPresentationActive,
    selfDealCards,
    selfVisibleCardCount,
    visibleSelfHand: state.selfHand,
  });
  const activeReturnTargetPlan = challengeReturnPlan
    ? {
        challengeResult: challengeReturnPlan.challengeResult,
        returnRevealSelfCards: challengeReturnPlan.batch.returnRevealSelfCards,
        returnHiddenSelfCardIds: challengeReturnPlan.batch.returnHiddenSelfCardIds,
        returnTargetCardCounts: challengeReturnPlan.batch.returnTargetCardCounts,
        returnTargetSelfCards: challengeReturnPlan.batch.returnTargetSelfCards,
        turnSeq: challengeReturnPlan.batch.turnSeq,
      }
    : returnTargetPlan;
  const returnTargetSelfCards = activeReturnTargetPlan?.returnTargetSelfCards ?? [];
  const returnHiddenSelfCardIdSet = useMemo(
    () => new Set(activeReturnTargetPlan?.returnHiddenSelfCardIds ?? []),
    [activeReturnTargetPlan?.returnHiddenSelfCardIds],
  );
  const returnVisibleSelfHand =
    returnHiddenSelfCardIdSet.size > 0
      ? state.selfHand.filter((card) => !returnHiddenSelfCardIdSet.has(card.id))
      : visibleSelfHand;
  const outgoingPlayCardIdSet = useMemo(() => new Set(outgoingPlayCardIds), [outgoingPlayCardIds]);
  const playVisibleSelfHand =
    outgoingPlayCardIdSet.size > 0
      ? returnVisibleSelfHand.filter((card) => !outgoingPlayCardIdSet.has(card.id))
      : returnVisibleSelfHand;
  const returnTargetCardCounts = activeReturnTargetPlan?.returnTargetCardCounts ?? {};
  const visibleDiscardCards = challengeReturnPlan?.displayCards ?? state.discardPileCards;
  const challengeOverlayEvent = challengeReturnPlan?.challengeEvent ?? null;
  const challengeOverlayPhase = challengeReturnPlan?.phase ?? "announce";
  const playingOut = playFlightCards.length > 0;
  const playTransitionActive = playingOut || outgoingPlayCardIds.length > 0;
  const canAutoPlay = Boolean(isSelfTurn && !dealPresentationActive && !followRank && !resolvingPendingWin && state.selfHand.length > 0 && state.status !== "finished");
  const canSkip = Boolean(isSelfTurn && !dealPresentationActive && (followRank || resolvingPendingWin) && state.status !== "finished");
  const canSkipTurn = Boolean(canSkip && !resolvingPendingWin);
  const canConfirmPendingWin = Boolean(canSkip && resolvingPendingWin);
  const shouldShowCountdown = canAutoPlay || canSkip;
  const serverNow = serverNowState.now;
  const turnCountdown = state.turnDeadlineAt
    ? Math.min(TURN_COUNTDOWN_SECONDS, Math.max(0, Math.ceil((state.turnDeadlineAt - serverNow) / 1000)))
    : TURN_COUNTDOWN_SECONDS;
  const selfCardBack = state.players.find((player) => player.playerId === selfPlayerId)?.cardBack ?? 0;

  const completeReturnFlight = useCallback((cardId: string) => {
    completedReturnFlightIdsRef.current.add(cardId);

    if (returnFlightsRef.current.length > 0 && completedReturnFlightIdsRef.current.size >= returnFlightsRef.current.length) {
      completedReturnFlightIdsRef.current.clear();
      setReturnFlights([]);
      setReturnTargetPlan(null);
    }
  }, []);

  useEffect(() => {
    returnFlightsRef.current = returnFlights;

    if (!returnFlights.length) {
      completedReturnFlightIdsRef.current.clear();
    }
  }, [returnFlights]);

  const startReturnFlights = useCallback((flights: ReturnFlightCard[]) => {
    completedReturnFlightIdsRef.current.clear();
    returnFlightsRef.current = flights;
    setReturnFlights(flights);
  }, []);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    if (!shouldShowCountdown || busy || dealPresentationActive || playTransitionActive || challengeReturnPlan || returnFlights.length) {
      return;
    }

    if (turnCountdown <= 0) {
      if (canAutoPlay) {
        const autoCard = state.selfHand[0];
        const autoDeclaredRank = isJokerRank(autoCard.rank) ? "A" : autoCard.rank;
        onDeclaredRankChange(autoDeclaredRank);
        onPlayCards(autoDeclaredRank, [autoCard.id]);
        return;
      }

      if (canConfirmPendingWin) {
        onPlayCards();
        return;
      }

      onSkipTurn();
      return;
    }

    const countdownTimer = window.setTimeout(() => {
      setServerNowState({
        key: countdownKey,
        now: Date.now(),
      });
    }, 1000);

    return () => window.clearTimeout(countdownTimer);
  }, [
    busy,
    canAutoPlay,
    canConfirmPendingWin,
    challengeReturnPlan,
    dealPresentationActive,
    onDeclaredRankChange,
    onPlayCards,
    onSkipTurn,
    playTransitionActive,
    returnFlights.length,
    shouldShowCountdown,
    state.selfHand,
    turnCountdown,
    countdownKey,
  ]);

  useEffect(() => {
    if (!outgoingPlayCardIds.length) {
      return;
    }

    const selfHandCardIds = new Set(state.selfHand.map((card) => card.id));
    const removedFromHand = outgoingPlayCardIds.every((cardId) => !selfHandCardIds.has(cardId));

    if (removedFromHand) {
      const clearTimer = window.setTimeout(() => {
        setOutgoingPlayCardIds([]);
        setPlayFlightCards([]);
      }, 0);

      return () => window.clearTimeout(clearTimer);
    }
  }, [outgoingPlayCardIds, state.selfHand]);

  useEffect(() => {
    if (!outgoingPlayCardIds.length || busy) {
      return;
    }

    const fallbackTimer = window.setTimeout(() => {
      setOutgoingPlayCardIds([]);
      setPlayFlightCards([]);
      pendingPlayDeclaredRankRef.current = undefined;
      pendingPlayCardIdsRef.current = undefined;
    }, 1400);

    return () => window.clearTimeout(fallbackTimer);
  }, [busy, outgoingPlayCardIds]);

  useEffect(() => {
    if (!declareModalOpen) {
      return;
    }

    const updateDeclareRankCardScale = () => setDeclareRankCardLayout(getDeclareRankCardLayout());

    updateDeclareRankCardScale();
    window.addEventListener("resize", updateDeclareRankCardScale);
    window.visualViewport?.addEventListener("resize", updateDeclareRankCardScale);

    return () => {
      window.removeEventListener("resize", updateDeclareRankCardScale);
      window.visualViewport?.removeEventListener("resize", updateDeclareRankCardScale);
    };
  }, [declareModalOpen]);

  useLayoutEffect(() => {
    if (state.discardPileCards.length) {
      processedReturnTurnSeqRef.current = null;
      startedReturnTurnSeqRef.current = null;
      lastDiscardSnapshotRef.current = {
        cards: state.discardPileCards,
        selfHand: state.selfHand,
      };
      const clearReturnTargetTimer = window.setTimeout(() => setReturnTargetPlan(null), 0);

      return () => window.clearTimeout(clearReturnTargetTimer);
    }

    const previousDiscardCards = lastDiscardSnapshotRef.current.cards;
    const previousSelfHand = lastDiscardSnapshotRef.current.selfHand;

    if (
      !previousDiscardCards.length ||
      challengeReturnPlan?.batch.turnSeq === state.turnSeq ||
      processedReturnTurnSeqRef.current === state.turnSeq ||
      startedReturnTurnSeqRef.current === state.turnSeq
    ) {
      return;
    }

    const revealEvent = getLatestChallengeResolvedEvent(events, state.turnSeq);

    if (!revealEvent) {
      return;
    }

    startedReturnTurnSeqRef.current = state.turnSeq;

    const targetPlayerId = revealEvent.pileTakenByPlayerId;
    const returnToSelf = targetPlayerId === selfPlayerId;
    const previousSelfCardIds = new Set(previousSelfHand.map((card) => card.id));
    const returnedSelfCards = returnToSelf ? state.selfHand.filter((card) => !previousSelfCardIds.has(card.id)) : [];
    const returnedSelfCardIds = new Set(returnedSelfCards.map((card) => card.id));
    const returnTargetIndexBySelfCardId = new Map(
      groupHandCards(state.selfHand)
        .flatMap((group) => group.cards)
        .filter((card) => returnedSelfCardIds.has(card.id))
        .map((card, index) => [card.id, index]),
    );
    const currentTargetPlayer = state.players.find((player) => player.playerId === targetPlayerId);
    const returnTargetCardCount = currentTargetPlayer?.cardCount ?? previousDiscardCards.length;
    const firstReturnTargetIndex = Math.max(0, returnTargetCardCount - previousDiscardCards.length);
    const batchId = Date.now();
    const nextFlights = previousDiscardCards.map((card, index) => {
      const startPose = getScatteredDiscardPose(index);
      const returnedSelfCard = returnedSelfCards[index];

      return {
        id: `${state.turnSeq}-${card.playedByPlayerId}-${index}-${batchId}`,
        cardBack: card.cardBack,
        playerId: targetPlayerId,
        sourceIndex: index,
        sourcePlayedByPlayerId: card.playedByPlayerId,
        sourceTurnSeq: card.turnSeq,
        startX: startPose.x,
        startY: startPose.y,
        startRotate: startPose.rotate,
        targetSelf: returnToSelf,
        targetIndex: returnedSelfCard ? (returnTargetIndexBySelfCardId.get(returnedSelfCard.id) ?? index) : firstReturnTargetIndex + index,
        zIndex: previousDiscardCards.length - index,
      };
    });

    const batch = {
      displayDiscardCards: previousDiscardCards,
      flights: nextFlights,
      returnRevealSelfCards: returnedSelfCards,
      returnHiddenSelfCardIds: returnedSelfCards.map((card) => card.id),
      returnTargetCardCounts: returnToSelf ? {} : { [targetPlayerId]: returnTargetCardCount },
      returnTargetSelfCards: returnToSelf ? state.selfHand : [],
      turnSeq: state.turnSeq,
    };

    setChallengeReturnPlan({
      batch,
      challengeEvent: revealEvent,
      challengeResult: null,
      displayCards: previousDiscardCards,
      phase: "announce",
    });
  }, [
    challengeReturnPlan?.batch.turnSeq,
    events,
    selfPlayerId,
    state.discardPileCards,
    state.players,
    state.selfHand,
    state.turnSeq,
  ]);

  useEffect(() => {
    if (!challengeReturnPlan || challengeReturnPlan.phase !== "announce") {
      return;
    }

    const revealEvent = getLatestChallengeResolvedEvent(events, challengeReturnPlan.batch.turnSeq);

    if (!revealEvent) {
      return;
    }

    const revealTimer = window.setTimeout(() => {
      setChallengeReturnPlan((current) =>
        current?.batch.turnSeq === revealEvent.turnSeq
          ? {
              ...current,
              challengeEvent: revealEvent,
              challengeResult: revealEvent,
              displayCards: revealDiscardCards({
                cards: current.batch.displayDiscardCards,
                event: revealEvent,
                returnedCards: current.batch.returnRevealSelfCards,
                selfPlayerId,
              }),
              phase: "result",
            }
          : current,
      );
    }, CHALLENGE_ANNOUNCE_HOLD_SECONDS * 1000);

    return () => window.clearTimeout(revealTimer);
  }, [challengeReturnPlan, events, selfPlayerId]);

  useEffect(() => {
    if (!challengeReturnPlan?.challengeResult || challengeReturnPlan.phase !== "result") {
      return;
    }

    const { batch, challengeResult } = challengeReturnPlan;
    const flightDelay = CHALLENGE_RESULT_HOLD_SECONDS * 1000;
    const startTimer = window.setTimeout(() => {
      processedReturnTurnSeqRef.current = batch.turnSeq;
      setReturnTargetPlan({
        returnHiddenSelfCardIds: batch.returnHiddenSelfCardIds,
        returnTargetCardCounts: batch.returnTargetCardCounts,
        returnTargetSelfCards: batch.returnTargetSelfCards,
        challengeResult,
        turnSeq: batch.turnSeq,
      });
      setChallengeReturnPlan(null);
      startReturnFlights(
        revealReturnFlights({
          event: challengeResult,
          flights: batch.flights,
          returnedCards: batch.returnRevealSelfCards,
          selfPlayerId,
        }),
      );
    }, flightDelay);

    return () => {
      window.clearTimeout(startTimer);
    };
  }, [challengeReturnPlan, selfPlayerId, startReturnFlights]);

  const startPlayFlight = useCallback(
    (declaredRank?: DeclaredRank) => {
      const selectedCards = state.selfHand.filter((card) => selectedCardIds.includes(card.id));
      const orderedCardIds = selectedCards.map((card) => card.id);

      if (!selectedCards.length) {
        onPlayCards(declaredRank);
        return;
      }

      const measuredCards = measurePlayFlightCards(selectedCards, selfCardBack, state.discardPileCards.length);

      if (!measuredCards.length) {
        onPlayCards(declaredRank, orderedCardIds);
        return;
      }

      pendingPlayDeclaredRankRef.current = declaredRank;
      pendingPlayCardIdsRef.current = orderedCardIds;
      setOutgoingPlayCardIds(orderedCardIds);
      setPlayFlightCards(measuredCards);
    },
    [onPlayCards, selectedCardIds, selfCardBack, state.discardPileCards.length, state.selfHand],
  );

  const completePlayFlight = useCallback(() => {
    const declaredRank = pendingPlayDeclaredRankRef.current;
    const orderedCardIds = pendingPlayCardIdsRef.current;

    pendingPlayDeclaredRankRef.current = undefined;
    pendingPlayCardIdsRef.current = undefined;
    onPlayCards(declaredRank, orderedCardIds);
  }, [onPlayCards]);

  function handlePlayButtonClick() {
    if (playTransitionActive) {
      return;
    }

    if (resolvingPendingWin) {
      onPlayCards();
      return;
    }

    if (followRank) {
      startPlayFlight();
      return;
    }

    setDeclareModalOpen(true);
  }

  function handleSkipButtonClick() {
    if (!canSkip || busy || playTransitionActive || dealPresentationActive) {
      return;
    }

    setDeclareModalOpen(false);

    if (canConfirmPendingWin) {
      onPlayCards();
      return;
    }

    onSkipTurn();
  }

  function handleDeclaredRank(rank: DeclaredRank) {
    onDeclaredRankChange(rank);
    setDeclareModalOpen(false);
    startPlayFlight(rank);
  }

  return (
    <div className="lie-game-table relative grid h-full max-h-dvh min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-2 overflow-hidden px-3 py-2 sm:gap-4 sm:px-4 sm:py-4 xl:px-1">
      <section className="grid min-h-0 grid-cols-2 gap-2 sm:gap-3">
        {opponents.map((player) => (
          <PlayerSeat
            key={player.playerId}
            player={{
              ...player,
              cardCount: dealPresentationActive ? (visibleCardCounts[player.playerId] ?? 0) : player.cardCount,
            }}
            active={player.playerId === state.currentPlayerId}
            dealing={dealPresentationActive}
            dealTargetCardCount={dealPresentationActive ? player.cardCount : undefined}
            owner={Boolean(ownerUserId && player.userId === ownerUserId)}
            returnTargetCardCount={returnTargetCardCounts[player.playerId]}
          />
        ))}
      </section>

      <div className="lie-table-surface">
        <TableStatusPanel followRank={followRank} state={state} />
        <DealFlightLayer
          flights={dealFlights}
          onFlightComplete={completeDealFlight}
          remainingDeckCount={remainingDeckCount}
        />
        <TableCenterNotice event={null} players={state.players} selfPlayerId={selfPlayerId} state={state} />
        <DiscardPile
          animateEnter={!challengeReturnPlan && !outgoingPlayCardIds.length}
          cards={visibleDiscardCards}
          players={state.players}
          selfPlayerId={selfPlayerId}
        />
        <PlayFlightLayer cards={playFlightCards} onComplete={completePlayFlight} />
        <ReturnFlightLayer cards={returnFlights} onCardComplete={completeReturnFlight} />
      </div>

      <section className="relative z-[120] grid min-h-0 gap-2 sm:gap-3">
        <div className="lie-game-action-slot">
          <div
            aria-hidden={!isSelfTurn}
            className="grid justify-items-center gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center"
            data-visible={isSelfTurn && !dealPresentationActive ? "true" : "false"}
          >
            {isSelfTurn && !dealPresentationActive ? (
              <div className="relative flex w-full max-w-[32rem] items-center justify-center whitespace-nowrap">
                <div
                  className={`grid w-full min-w-0 shrink gap-2 ${
                    canChallenge && canSkip && !resolvingPendingWin
                      ? "max-w-[26rem] grid-cols-3"
                      : resolvingPendingWin || canSkip
                        ? "max-w-[18rem] grid-cols-2"
                        : "max-w-[10rem] grid-cols-1"
                  }`}
                >
                  {!resolvingPendingWin ? (
                    <PixelButton
                      onClick={handlePlayButtonClick}
                      disabled={busy || playTransitionActive || dealPresentationActive || !canPlay || (selectedCardIds.length < 1 || selectedCardIds.length > 4)}
                      variant="primary"
                      className="w-full"
                    >
                      {followRank ? "跟牌" : "出牌"}
                    </PixelButton>
                  ) : null}
                  {canChallenge ? (
                    <PixelButton
                      onClick={onChallenge}
                      disabled={busy || playTransitionActive || dealPresentationActive}
                      variant="ghost"
                      className="w-full"
                    >
                      质疑
                    </PixelButton>
                  ) : null}
                  {canSkip ? (
                    <PixelButton
                      onClick={handleSkipButtonClick}
                      disabled={busy || playTransitionActive || dealPresentationActive}
                      variant="ghost"
                      className="w-full"
                    >
                      跳过
                    </PixelButton>
                  ) : null}
                </div>
                {shouldShowCountdown ? (
                  <span className="pointer-events-none absolute right-0 top-0 z-10 -translate-y-1/2 translate-x-1/3 rounded-sm border border-[#f4d57a]/70 bg-[#173332] px-1.5 py-0.5 text-xs font-black leading-none text-[#f4d57a] shadow-[0_2px_0_rgba(0,0,0,0.35)]">
                    {turnCountdown}s
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        {resolvingPendingWin ? (
          <p className="text-sm text-[#c6b889]">上一手玩家已打空手牌。你可以质疑；如果不质疑，点击主按钮会直接确认其获胜。</p>
        ) : null}
        <Hand
          cards={playVisibleSelfHand}
          dealing={dealPresentationActive}
          dealTargetCards={dealPresentationActive ? dealTargetSelfHand : undefined}
          returnTargetCards={returnTargetSelfCards.length ? returnTargetSelfCards : undefined}
          disabled={!isSelfTurn || playTransitionActive || dealPresentationActive || state.status === "finished"}
          selectedCardIds={selectedCardIds}
          hiddenCardIds={[]}
          onToggleCard={onToggleCard}
          onSetCardSelected={onSetCardSelected}
        />
      </section>

      {declareModalOpen && !followRank ? (
        <PixelModal title="声明点数" onClose={() => setDeclareModalOpen(false)} className="lie-declare-rank-modal">
          <div
            className="lie-declare-rank-grid mt-2 grid"
            style={
              {
                "--declare-card-columns": declareRankCardLayout.columns,
                "--declare-card-scale": declareRankCardLayout.scale,
              } as CSSProperties
            }
          >
            {DECLARABLE_RANKS.map((rank) => (
              <button
                key={rank}
                type="button"
                className="lie-declare-rank-card-button grid cursor-pointer place-items-center bg-transparent p-0 transition-transform hover:scale-105 focus-visible:scale-105 focus-visible:outline-none"
                onClick={() => handleDeclaredRank(rank)}
              >
                <DomPlayingCard card={{ id: `${rank}H`, rank, suit: "H" }} cornerOnly className="lie-declare-rank-card" />
              </button>
            ))}
          </div>
        </PixelModal>
      ) : null}
      <ChallengeOverlay
        event={challengeOverlayEvent}
        nextPlayerId={state.currentPlayerId}
        phase={challengeOverlayPhase}
        players={state.players}
        selfPlayerId={selfPlayerId}
      />
    </div>
  );
}
