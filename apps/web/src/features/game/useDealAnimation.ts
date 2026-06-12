/**
 * @Description: 首轮发牌动画状态机，负责生成飞牌计划、维护临时可见牌数和完成回调。
 *
 * @Date 2026-06-12 14:47
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Card, PublicGameState } from "@lie/shared";
import { DEAL_CARD_FLIGHT_SECONDS, DEAL_CARD_STAGGER_SECONDS } from "./gameTableConstants";
import { groupHandCards } from "./Hand";
import type { DealFlightCard, GamePlayer, VisibleCardCounts } from "./gameTableTypes";

function getTargetCardCounts(players: GamePlayer[]) {
  return Object.fromEntries(players.map((player) => [player.playerId, player.cardCount])) as VisibleCardCounts;
}

function getSelfDealCardsByBottomFirstLayout(cards: Card[]) {
  return groupHandCards(cards).flatMap((group) => [...group.cards].reverse());
}

function getInitialDealVisibleCardCounts(dealPlan: ReturnType<typeof createDealPlan>) {
  return dealPlan.shouldDeal
    ? (Object.fromEntries(dealPlan.players.map((player) => [player.playerId, 0])) as VisibleCardCounts)
    : dealPlan.targetCounts;
}

function isInitialDealState(status: PublicGameState["status"], turnSeq: PublicGameState["turnSeq"], discardPileCount: PublicGameState["discardPileCount"]) {
  return status === "playing" && turnSeq === 1 && discardPileCount === 0;
}

function createDealPlan({
  discardPileCount,
  matchId,
  players: statePlayers,
  selfHand,
  selfPlayerId,
  status,
  turnSeq,
}: {
  discardPileCount: PublicGameState["discardPileCount"];
  matchId: PublicGameState["matchId"];
  players: PublicGameState["players"];
  selfHand: PublicGameState["selfHand"];
  selfPlayerId?: string | null;
  status: PublicGameState["status"];
  turnSeq: PublicGameState["turnSeq"];
}) {
  const players = [...statePlayers].sort((left, right) => left.seatIndex - right.seatIndex);
  const targetCounts = getTargetCardCounts(players);
  const maxCards = Math.max(...players.map((player) => player.cardCount), 0);
  const dealSequence = Array.from({ length: maxCards }).flatMap((_, cardIndex) =>
    players.filter((player) => cardIndex < player.cardCount).map((player) => player.playerId),
  );
  const selfDealCards = getSelfDealCardsByBottomFirstLayout(selfHand);
  const dealtCountByPlayerId = new Map<string, number>();
  const flights = dealSequence.map((playerId, orderIndex) => {
    const player = players.find((candidate) => candidate.playerId === playerId);
    const targetIndex = dealtCountByPlayerId.get(playerId) ?? 0;
    const selfCard = playerId === selfPlayerId ? selfDealCards[targetIndex] : undefined;

    dealtCountByPlayerId.set(playerId, targetIndex + 1);

    return {
      id: `${matchId}-${orderIndex}-${playerId}`,
      playerId,
      cardBack: player?.cardBack ?? 0,
      selfCard,
      orderIndex,
      targetIndex,
    };
  });
  const playerSignature = players.map((player) => `${player.playerId}:${player.cardCount}:${player.cardBack ?? 0}`).join("|");
  const initialDeal = isInitialDealState(status, turnSeq, discardPileCount);
  const selfPlayer = selfPlayerId ? players.find((player) => player.playerId === selfPlayerId) : null;
  const selfHandReady = Boolean(selfPlayerId) && (!selfPlayer || selfHand.length >= selfPlayer.cardCount);
  const selfHandReadiness = selfHandReady ? "ready" : `waiting:${selfHand.length}:${selfPlayer?.cardCount ?? 0}`;
  const key = [
    matchId,
    status,
    turnSeq,
    discardPileCount,
    selfPlayerId ?? "",
    playerSignature,
    selfHandReadiness,
  ].join("::");

  return {
    flights,
    key,
    matchId,
    players,
    selfDealCards,
    shouldDeal: initialDeal,
    waitForSelfPlayer: initialDeal && !selfHandReady,
    targetCounts,
  };
}

export function getDealVisibleSelfHand(selfDealCards: Card[], visibleCardCount: number) {
  return selfDealCards.slice(0, visibleCardCount);
}

export function getDealTargetSelfHand(selfDealCards: Card[]) {
  return selfDealCards;
}

export function getDealHandCards({
  dealing,
  selfDealCards,
  selfVisibleCardCount,
  visibleSelfHand,
}: {
  dealing: boolean;
  selfDealCards: Card[];
  selfVisibleCardCount: number;
  visibleSelfHand: Card[];
}) {
  if (!dealing) {
    return {
      dealTargetSelfHand: visibleSelfHand,
      visibleSelfHand,
    };
  }

  return {
    dealTargetSelfHand: getDealTargetSelfHand(selfDealCards),
    visibleSelfHand: getDealVisibleSelfHand(selfDealCards, selfVisibleCardCount),
  };
}

/**
 * @Description: 根据公开游戏状态生成首轮发牌动画计划，并在动画期间维护临时可见牌数。
 *
 * @param state 当前玩家视角的公开游戏状态。
 * @param selfPlayerId 当前玩家 ID，用于把自己的飞行牌翻成真实牌面。
 * @return 发牌动画状态、剩余牌库数量和单张飞牌完成回调。
 *
 * @Date 2026-06-12 14:47
 */
export function useDealAnimation(state: PublicGameState, selfPlayerId?: string | null) {
  const dealPlan = useMemo(
    () =>
      createDealPlan({
        discardPileCount: state.discardPileCount,
        matchId: state.matchId,
        players: state.players,
        selfHand: state.selfHand,
        selfPlayerId,
        status: state.status,
        turnSeq: state.turnSeq,
      }),
    [selfPlayerId, state.discardPileCount, state.matchId, state.players, state.selfHand, state.status, state.turnSeq],
  );
  const [visibleCardCounts, setVisibleCardCounts] = useState<VisibleCardCounts>(() => getInitialDealVisibleCardCounts(dealPlan));
  const [dealing, setDealing] = useState(() => dealPlan.shouldDeal);
  const [dealFlights, setDealFlights] = useState<DealFlightCard[]>([]);
  const [remainingDeckCount, setRemainingDeckCount] = useState(() => (dealPlan.shouldDeal ? dealPlan.flights.length : 0));
  const completedDealMatchIdRef = useRef<string | null>(null);
  const completedDealFlightIdsRef = useRef(new Set<string>());
  const dealPlanRef = useRef(dealPlan);

  useEffect(() => {
    dealPlanRef.current = dealPlan;
  }, [dealPlan]);

  useEffect(() => {
    const currentDealPlan = dealPlanRef.current;

    if (!currentDealPlan.shouldDeal || completedDealMatchIdRef.current === currentDealPlan.matchId) {
      setDealing(false);
      setRemainingDeckCount(0);
      setDealFlights([]);
      setVisibleCardCounts(currentDealPlan.targetCounts);
      return;
    }

    setDealing(true);
    completedDealFlightIdsRef.current.clear();
    setVisibleCardCounts(Object.fromEntries(currentDealPlan.players.map((player) => [player.playerId, 0])) as VisibleCardCounts);

    if (currentDealPlan.waitForSelfPlayer) {
      setRemainingDeckCount(currentDealPlan.flights.length);
      setDealFlights([]);
      return;
    }

    setRemainingDeckCount(currentDealPlan.flights.length);
    setDealFlights(currentDealPlan.flights);

    const endTimer = window.setTimeout(
      () => {
        completedDealMatchIdRef.current = currentDealPlan.matchId;
        completedDealFlightIdsRef.current.clear();
        setVisibleCardCounts(currentDealPlan.targetCounts);
        setRemainingDeckCount(0);
        setDealFlights([]);
        setDealing(false);
      },
      currentDealPlan.flights.length * DEAL_CARD_STAGGER_SECONDS * 1000 + DEAL_CARD_FLIGHT_SECONDS * 1000 + 1800,
    );

    return () => window.clearTimeout(endTimer);
  }, [dealPlan.key]);

  const completeDealFlight = useCallback((flight: DealFlightCard) => {
    const currentDealPlan = dealPlanRef.current;

    if (completedDealFlightIdsRef.current.has(flight.id)) {
      return;
    }

    completedDealFlightIdsRef.current.add(flight.id);
    setVisibleCardCounts((currentCounts) => {
      const targetCount = currentDealPlan.targetCounts[flight.playerId] ?? Number.POSITIVE_INFINITY;
      const nextCount = Math.min((currentCounts[flight.playerId] ?? 0) + 1, targetCount);

      if (currentCounts[flight.playerId] === nextCount) {
        return currentCounts;
      }

      return {
        ...currentCounts,
        [flight.playerId]: nextCount,
      };
    });
    setRemainingDeckCount((currentCount) => Math.max(0, currentCount - 1));

    if (completedDealFlightIdsRef.current.size >= currentDealPlan.flights.length) {
      completedDealMatchIdRef.current = currentDealPlan.matchId;
      completedDealFlightIdsRef.current.clear();
      setVisibleCardCounts(currentDealPlan.targetCounts);
      setRemainingDeckCount(0);
      setDealFlights([]);
      setDealing(false);
    }
  }, []);

  return {
    completeDealFlight,
    dealFlights,
    dealing,
    remainingDeckCount,
    selfDealCards: dealPlan.selfDealCards,
    visibleCardCounts,
  };
}
