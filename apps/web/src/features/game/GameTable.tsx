/**
 * @Description: 游戏桌面组件：展示对手牌背堆、弃牌堆、手牌和操作按钮，并承载发牌/出牌动画。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { DECLARABLE_RANKS, type Card, type DeclaredRank } from "@lie/shared";
import { gsap } from "gsap";
import { Swords, ThumbsDown } from "lucide-react";
import type { PublicGameEvent, PublicGameState } from "@lie/shared";
import PixelButton from "@/components/ui/PixelButton";
import PixelModal from "@/components/ui/PixelModal";
import CardBackArt from "@/components/cards/CardBackArt";
import DomPlayingCard from "@/components/cards/DomPlayingCard";
import Hand, { groupHandCards } from "./Hand";
import PlayerSeat from "./PlayerSeat";

type GamePlayer = PublicGameState["players"][number];
type PublicDiscardCard = PublicGameState["discardPileCards"][number];
type VisibleCardCounts = Record<string, number>;
type DealFlightCard = {
  id: string;
  playerId: string;
  cardBack: number;
  selfCard?: Card;
  orderIndex: number;
  targetIndex: number;
};
type ReturnFlightCard = {
  id: string;
  cardBack: number;
  selfCard?: Card;
  playerId: string;
  startX: number;
  startY: number;
  startRotate: number;
  targetIndex: number;
  zIndex: number;
};

type DiscardGroupMeta = {
  cardIndex: number;
  cardCount: number;
  groupIndex: number;
};

type DealFlightTargetPose = {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  visible: boolean;
};

const DISCARD_CARD_STAGGER_SECONDS = 0.086;
const DISCARD_CARD_FLIGHT_SECONDS = 0.52;
const DISCARD_RETURN_STAGGER_SECONDS = 0.058;
const DISCARD_RETURN_FLIGHT_SECONDS = 0.62;
const DEAL_CARD_FLIGHT_SECONDS = 0.18;
const DEAL_CARD_NEXT_START_RATIO = 0.68;

function getTargetCardCounts(players: GamePlayer[]) {
  return Object.fromEntries(players.map((player) => [player.playerId, player.cardCount])) as VisibleCardCounts;
}

function getSelfDealCardsByBottomFirstLayout(cards: Card[]) {
  return groupHandCards(cards).flatMap((group) => [...group.cards].reverse());
}

function getDealFlightArc(orderIndex: number, selfCard?: Card) {
  const direction = orderIndex % 2 === 0 ? -1 : 1;

  return {
    midX: direction * (10 + (orderIndex % 3) * 4),
    midY: -20 - (orderIndex % 4) * 3,
    overshootX: direction * (3 + (orderIndex % 2)),
    overshootY: -4 - (orderIndex % 3),
    startRotate: -7 + (orderIndex % 5) * 3,
    settleRotate: selfCard ? direction * 2.4 : direction * 1.6,
  };
}

function getElementRotation(element: HTMLElement) {
  const transform = window.getComputedStyle(element).transform;

  if (!transform || transform === "none") {
    return 0;
  }

  const matrix = new DOMMatrixReadOnly(transform);
  return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
}

function getDealFlightTargetPose(targetNode: HTMLElement | null, shell: HTMLElement, layer: HTMLElement): DealFlightTargetPose {
  if (!targetNode) {
    return {
      x: 0,
      y: 0,
      rotate: 0,
      scale: 0.96,
      visible: false,
    };
  }

  const layerBounds = layer.getBoundingClientRect();
  const originX = layerBounds.left + layerBounds.width / 2;
  const originY = layerBounds.top + layerBounds.height * 0.55;
  const targetBounds = targetNode.getBoundingClientRect();
  const shellBounds = shell.getBoundingClientRect();

  return {
    x: targetBounds.left + targetBounds.width / 2 - originX,
    y: targetBounds.top + targetBounds.height / 2 - originY,
    rotate: getElementRotation(targetNode),
    scale: Math.max(0.62, Math.min(1.7, targetBounds.width / Math.max(shellBounds.width, 1))),
    visible: true,
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
function useDealAnimation(state: PublicGameState, selfPlayerId?: string | null) {
  const dealPlan = useMemo(() => {
    const players = [...state.players].sort((left, right) => left.seatIndex - right.seatIndex);
    const targetCounts = getTargetCardCounts(players);
    const maxCards = Math.max(...players.map((player) => player.cardCount), 0);
    const dealSequence = Array.from({ length: maxCards }).flatMap((_, cardIndex) =>
      players.filter((player) => cardIndex < player.cardCount).map((player) => player.playerId),
    );
    const selfDealCards = getSelfDealCardsByBottomFirstLayout(state.selfHand);
    const dealtCountByPlayerId = new Map<string, number>();
    const flights = dealSequence.map((playerId, orderIndex) => {
      const player = players.find((candidate) => candidate.playerId === playerId);
      const targetIndex = dealtCountByPlayerId.get(playerId) ?? 0;
      const selfCard = playerId === selfPlayerId ? selfDealCards[targetIndex] : undefined;

      dealtCountByPlayerId.set(playerId, targetIndex + 1);

      return {
        id: `${state.matchId}-${orderIndex}-${playerId}`,
        playerId,
        cardBack: player?.cardBack ?? 0,
        selfCard,
        orderIndex,
        targetIndex,
      };
    });
    const playerSignature = players.map((player) => `${player.playerId}:${player.cardCount}:${player.cardBack ?? 0}`).join("|");
    const selfHandSignature = state.selfHand.map((card) => card.id).join("|");
    const key = [
      state.matchId,
      state.status,
      state.turnSeq,
      state.discardPileCount,
      selfPlayerId ?? "",
      playerSignature,
      selfHandSignature,
    ].join("::");

    return {
      flights,
      key,
      matchId: state.matchId,
      players,
      selfDealCards,
      shouldDeal: state.status === "playing" && state.turnSeq === 1 && state.discardPileCount === 0,
      targetCounts,
    };
  }, [selfPlayerId, state.discardPileCount, state.matchId, state.players, state.selfHand, state.status, state.turnSeq]);
  const [visibleCardCounts, setVisibleCardCounts] = useState<VisibleCardCounts>(() => dealPlan.targetCounts);
  const [dealing, setDealing] = useState(false);
  const [dealFlights, setDealFlights] = useState<DealFlightCard[]>([]);
  const [remainingDeckCount, setRemainingDeckCount] = useState(0);
  const completedDealMatchIdRef = useRef<string | null>(null);
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
    setVisibleCardCounts(Object.fromEntries(currentDealPlan.players.map((player) => [player.playerId, 0])) as VisibleCardCounts);
    setRemainingDeckCount(currentDealPlan.flights.length);
    setDealFlights(currentDealPlan.flights[0] ? [currentDealPlan.flights[0]] : []);

    const endTimer = window.setTimeout(
      () => {
        completedDealMatchIdRef.current = currentDealPlan.matchId;
        setVisibleCardCounts(currentDealPlan.targetCounts);
        setRemainingDeckCount(0);
        setDealFlights([]);
        setDealing(false);
      },
      currentDealPlan.flights.length * DEAL_CARD_FLIGHT_SECONDS * DEAL_CARD_NEXT_START_RATIO * 1000 + DEAL_CARD_FLIGHT_SECONDS * 1000 + 1000,
    );

    return () => window.clearTimeout(endTimer);
  }, [dealPlan.key]);

  const completeDealFlight = useCallback((flight: DealFlightCard) => {
    const currentDealPlan = dealPlanRef.current;
    const nextFlight = currentDealPlan.flights[flight.orderIndex + 1] ?? null;

    setVisibleCardCounts((current) => ({
      ...current,
      [flight.playerId]: (current[flight.playerId] ?? 0) + 1,
    }));
    setRemainingDeckCount((current) => Math.max(0, current - 1));
    setDealFlights((current) => {
      const withoutCompletedFlight = current.filter((currentFlight) => currentFlight.id !== flight.id);

      if (!nextFlight || withoutCompletedFlight.some((currentFlight) => currentFlight.id === nextFlight.id)) {
        return withoutCompletedFlight;
      }

      return [...withoutCompletedFlight, nextFlight];
    });

    if (!nextFlight) {
      completedDealMatchIdRef.current = currentDealPlan.matchId;
      setVisibleCardCounts(currentDealPlan.targetCounts);
      setRemainingDeckCount(0);
      setDealing(false);
    }
  }, []);

  const startNextDealFlight = useCallback((flight: DealFlightCard) => {
    const nextFlight = dealPlanRef.current.flights[flight.orderIndex + 1] ?? null;

    if (!nextFlight) {
      return;
    }

    setDealFlights((current) => (current.some((currentFlight) => currentFlight.id === nextFlight.id) ? current : [...current, nextFlight]));
  }, []);

  return {
    completeDealFlight,
    dealFlights,
    dealing,
    remainingDeckCount,
    selfDealCards: dealPlan.selfDealCards,
    startNextDealFlight,
    visibleCardCounts,
  };
}

function getDiscardGroupKey(card: PublicDiscardCard) {
  return `${card.turnSeq}:${card.playedByPlayerId}`;
}

/**
 * @Description: 按出牌 turnSeq 与玩家分组弃牌堆，保证同一手多张牌以小堆形式一起飞入。
 *
 * @param cards 当前公开弃牌堆牌背列表。
 * @return 每张牌对应的组内位置和总组数。
 *
 * @Date 2026-06-12 14:47
 */
function getDiscardGroupMeta(cards: PublicDiscardCard[]) {
  const groups = new Map<string, PublicDiscardCard[]>();
  const groupOrder: string[] = [];

  for (const card of cards) {
    const key = getDiscardGroupKey(card);
    const group = groups.get(key);

    if (group) {
      group.push(card);
      continue;
    }

    groupOrder.push(key);
    groups.set(key, [card]);
  }

  const metaByCard = new WeakMap<PublicDiscardCard, DiscardGroupMeta>();

  groupOrder.forEach((key, groupIndex) => {
    const groupCards = groups.get(key) ?? [];

    groupCards.forEach((card, cardIndex) => {
      metaByCard.set(card, {
        cardIndex,
        cardCount: groupCards.length,
        groupIndex,
      });
    });
  });

  return {
    groupCount: groupOrder.length,
    metaByCard,
  };
}

function getScatteredDiscardPose(index: number) {
  const x = ((index * 29) % 95) - 47;
  const y = ((index * 37) % 73) - 36;
  const rotate = ((index * 43) % 70) - 35;

  return { x, y, rotate };
}

/**
 * @Description: 计算弃牌飞入动画的起点，让自己的牌从手牌区飞出，对手牌从座位方向飞出。
 *
 * @param card 当前弃牌牌背。
 * @param players 当前公开玩家列表。
 * @param selfPlayerId 当前玩家 ID。
 * @return 飞行动画起点位移和旋转角。
 *
 * @Date 2026-06-12 14:47
 */
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

function DiscardPile({
  cards,
  players,
  selfPlayerId,
}: {
  cards: PublicDiscardCard[];
  players: GamePlayer[];
  selfPlayerId?: string | null;
}) {
  const pileRef = useRef<HTMLDivElement | null>(null);
  const animatedCardIdsRef = useRef(new Set<string>());
  const discardTweensRef = useRef(new Map<string, gsap.core.Tween>());
  const visibleCards = useMemo(() => cards.slice(-48), [cards]);
  const { metaByCard } = useMemo(() => getDiscardGroupMeta(cards), [cards]);

  useLayoutEffect(() => {
    if (!visibleCards.length) {
      animatedCardIdsRef.current.clear();
      discardTweensRef.current.forEach((tween) => tween.kill());
      discardTweensRef.current.clear();
      return;
    }

    if (!pileRef.current) {
      return;
    }

    const visibleCardIds = new Set(visibleCards.map((card, index) => `${card.turnSeq}-${card.playedByPlayerId}-${index}`));

    discardTweensRef.current.forEach((tween, cardId) => {
      if (!visibleCardIds.has(cardId)) {
        tween.kill();
        discardTweensRef.current.delete(cardId);
        animatedCardIdsRef.current.delete(cardId);
      }
    });

    visibleCards.forEach((card, index) => {
      const cardId = `${card.turnSeq}-${card.playedByPlayerId}-${index}`;

      if (animatedCardIdsRef.current.has(cardId)) {
        return;
      }

      const shell = pileRef.current?.querySelector<HTMLElement>(`[data-discard-card-id="${cardId}"]`);

      if (!shell) {
        return;
      }

      const meta = metaByCard.get(card) ?? { cardIndex: 0, cardCount: 1, groupIndex: index };
      const flightStart = getDiscardFlightStart(card, players, selfPlayerId);
      const flightStackOffset = meta.cardIndex - (meta.cardCount - 1) / 2;
      const isSelfCard = card.playedByPlayerId === selfPlayerId;
      const startX = flightStart.x + flightStackOffset * 0.8;
      const startRotate = flightStart.rotate + flightStackOffset * 0.6;

      animatedCardIdsRef.current.add(cardId);
      const tween = gsap.fromTo(
        shell,
        {
          x: startX,
          y: flightStart.y,
          rotate: startRotate,
          scale: isSelfCard ? 1.12 : 1.04,
          opacity: 0,
          filter: isSelfCard ? "drop-shadow(0 5px 7px rgba(8, 13, 14, 0.22))" : "drop-shadow(0 4px 6px rgba(8, 13, 14, 0.2))",
        },
          {
            x: 0,
            y: 0,
            rotate: 0,
            scale: 1,
            opacity: 1,
            filter: "drop-shadow(0 2px 3px rgba(8, 13, 14, 0.18))",
            duration: DISCARD_CARD_FLIGHT_SECONDS,
            ease: "back.out(1.18)",
          delay: meta.cardIndex * DISCARD_CARD_STAGGER_SECONDS,
          overwrite: "auto",
          onComplete: () => {
            discardTweensRef.current.delete(cardId);
          },
        },
      );

      discardTweensRef.current.set(cardId, tween);
    });
  }, [cards.length, metaByCard, players, selfPlayerId, visibleCards]);

  useEffect(() => {
    const discardTweens = discardTweensRef.current;

    return () => {
      discardTweens.forEach((tween) => tween.kill());
      discardTweens.clear();
    };
  }, []);

  return (
    <div ref={pileRef} className="lie-discard-pile" aria-label={`弃牌堆 ${cards.length} 张`}>
      {visibleCards.map((card, index) => {
        const meta = metaByCard.get(card) ?? { cardIndex: 0, cardCount: 1, groupIndex: index };
        const pose = getScatteredDiscardPose(cards.length - visibleCards.length + index);
        const cardId = `${card.turnSeq}-${card.playedByPlayerId}-${index}`;

        return (
          <div
            key={cardId}
            data-discard-card-id={cardId}
            className="lie-discard-pile-card-shell"
            style={
              {
                zIndex: cards.length - visibleCards.length + index,
              } as CSSProperties
            }
          >
            <CardBackArt
              back={card.cardBack}
              label="弃牌堆中的牌背"
              className="lie-discard-pile-card [--card-back-art-height:65px] [--card-back-art-width:49px] [--card-back-scale:1.55]"
              style={
                {
                  "--discard-card-x": `${pose.x}px`,
                  "--discard-card-y": `${pose.y}px`,
                  "--discard-card-rotate": `${pose.rotate}deg`,
                } as CSSProperties
              }
            />
          </div>
        );
      })}
    </div>
  );
}

function TableStatusPanel({ followRank, lastPlayCardCount }: { followRank: DeclaredRank | null; lastPlayCardCount?: number }) {
  const lastPlayCardCountLabel = typeof lastPlayCardCount === "number" ? `${lastPlayCardCount} 张` : "无";

  return (
    <aside className="lie-table-status-panel" aria-label="当前牌桌状态">
      <div>
        <span className="lie-table-status-label">当前点数</span>
        <strong>{followRank ?? "待声明"}</strong>
      </div>
      <div>
        <span className="lie-table-status-label">弃牌区</span>
        <strong>上一手 {lastPlayCardCountLabel}</strong>
      </div>
    </aside>
  );
}

/**
 * @Description: 渲染发牌飞行动画层，按真实 DOM 目标位置把牌库中的牌飞到座位或手牌。
 *
 * @param flights 发牌动画中的飞牌计划。
 * @param onFlightComplete 单张牌飞到目标后的回调。
 * @param remainingDeckCount 动画牌库中剩余可见数量。
 * @return 发牌动画覆盖层。
 *
 * @Date 2026-06-12 14:47
 */
function DealFlightLayer({
  flights,
  onFlightComplete,
  remainingDeckCount,
  onFlightReadyForNext,
}: {
  flights: DealFlightCard[];
  onFlightComplete: (flight: DealFlightCard) => void;
  remainingDeckCount: number;
  onFlightReadyForNext: (flight: DealFlightCard) => void;
}) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const startedFlightIdsRef = useRef(new Set<string>());
  const completedFlightIdsRef = useRef(new Set<string>());
  const readyFlightIdsRef = useRef(new Set<string>());
  const flightTimelinesRef = useRef(new Map<string, gsap.core.Timeline>());

  useLayoutEffect(() => {
    if (!flights.length || !layerRef.current) {
      return;
    }

    flights.forEach((flight) => {
      const shell = layerRef.current?.querySelector<HTMLElement>(`[data-deal-flight-card-id="${flight.id}"]`);

      if (!shell || !layerRef.current || startedFlightIdsRef.current.has(flight.id) || completedFlightIdsRef.current.has(flight.id)) {
        return;
      }

      startedFlightIdsRef.current.add(flight.id);
      const targetSelector = flight.selfCard ? `[data-hand-card-id="${flight.selfCard.id}"]` : `[data-deal-target="${flight.playerId}:${flight.targetIndex}"]`;
      const targetNode = document.querySelector<HTMLElement>(targetSelector);
      const targetPose = getDealFlightTargetPose(targetNode ?? null, shell, layerRef.current);
      const arc = getDealFlightArc(flight.orderIndex, flight.selfCard);
      const timeline = gsap.timeline();

      flightTimelinesRef.current.set(flight.id, timeline);

      timeline.fromTo(
        shell,
        {
          xPercent: -50,
          yPercent: -50,
          x: 0,
          y: 0,
          rotate: arc.startRotate,
          scale: 1,
          opacity: 0,
        },
        {
          xPercent: -50,
          yPercent: -50,
          x: targetPose.x * 0.58 + arc.midX,
          y: targetPose.y * 0.52 + arc.midY,
          rotate: targetPose.rotate + arc.settleRotate,
          scale: Math.max(0.82, Math.min(1.08, targetPose.scale * 1.04)),
          opacity: targetPose.visible ? 1 : 0.4,
          filter: "drop-shadow(0 9px 10px rgba(8, 13, 14, 0.24))",
          duration: DEAL_CARD_FLIGHT_SECONDS * 0.38,
          ease: "power2.out",
        },
        0,
      );

      timeline.to(
        shell,
        {
          x: targetPose.x + arc.overshootX,
          y: targetPose.y + arc.overshootY,
          rotate: targetPose.rotate - arc.settleRotate * 0.35,
          scale: targetPose.scale * 1.02,
          opacity: targetPose.visible ? 1 : 0,
          filter: "drop-shadow(0 5px 6px rgba(8, 13, 14, 0.22))",
          duration: DEAL_CARD_FLIGHT_SECONDS * 0.42,
          ease: "power3.in",
        },
        DEAL_CARD_FLIGHT_SECONDS * 0.38,
      );

      timeline.to(
        shell,
        {
          x: targetPose.x,
          y: targetPose.y,
          rotate: targetPose.rotate,
          scale: targetPose.scale,
          opacity: targetPose.visible ? 1 : 0,
          filter: "drop-shadow(0 3px 4px rgba(8, 13, 14, 0.2))",
          duration: DEAL_CARD_FLIGHT_SECONDS * 0.2,
          ease: "back.out(1.8)",
          onComplete: () => {
            if (completedFlightIdsRef.current.has(flight.id)) {
              return;
            }

            completedFlightIdsRef.current.add(flight.id);
            flightTimelinesRef.current.delete(flight.id);
            gsap.set(shell, { opacity: 0 });
            onFlightComplete(flight);
          },
        },
        DEAL_CARD_FLIGHT_SECONDS * 0.8,
      );

      timeline.call(
        () => {
          if (readyFlightIdsRef.current.has(flight.id)) {
            return;
          }

          readyFlightIdsRef.current.add(flight.id);
          onFlightReadyForNext(flight);
        },
        undefined,
        DEAL_CARD_FLIGHT_SECONDS * DEAL_CARD_NEXT_START_RATIO,
      );
    });
  }, [flights, onFlightComplete, onFlightReadyForNext]);

  useEffect(() => {
    const timelines = flightTimelinesRef.current;

    return () => {
      timelines.forEach((timeline) => timeline.kill());
      timelines.clear();
    };
  }, []);

  if (!flights.length) {
    return null;
  }

  return (
    <div ref={layerRef} className="lie-deal-flight-layer" aria-hidden>
      <div className="lie-deal-deck">
        {Array.from({ length: Math.min(7, remainingDeckCount) }).map((_, index) => (
          <CardBackArt
            key={`deal-deck-${index}`}
            back={flights[0]?.cardBack ?? 0}
            label="发牌区牌库"
            className="lie-deal-deck-card [--card-back-art-height:65px] [--card-back-art-width:49px] [--card-back-scale:1.55]"
            style={
              {
                "--deal-deck-card-x": `${index * 0.9}px`,
                "--deal-deck-card-y": `${index * -0.5}px`,
                "--deal-deck-card-rotate": `${-3 + index * 0.7}deg`,
                zIndex: index,
              } as CSSProperties
            }
          />
        ))}
        <span className="lie-deal-deck-count">{remainingDeckCount}</span>
      </div>
      {flights.map((flight) => (
        <span
          key={flight.id}
          data-deal-flight-card-id={flight.id}
          className="lie-deal-flight-card"
          style={{ zIndex: flights.length + flight.orderIndex } as CSSProperties}
        >
          {flight.selfCard ? (
            <DomPlayingCard
              card={flight.selfCard}
              label="发到你手中的牌"
              className="lie-deal-flight-side [--pixel-card-scale:1.55]"
            />
          ) : (
            <CardBackArt
              back={flight.cardBack}
              label="发牌中的牌背"
              className="lie-deal-flight-side [--card-back-art-height:65px] [--card-back-art-width:49px] [--card-back-scale:1.55]"
            />
          )}
        </span>
      ))}
    </div>
  );
}

/**
 * @Description: 渲染质疑结算时弃牌堆飞回失败方的动画层。
 *
 * @param cards 飞回动画中的牌背计划。
 * @return 弃牌堆回收动画覆盖层。
 *
 * @Date 2026-06-12 14:47
 */
function ReturnFlightLayer({ cards }: { cards: ReturnFlightCard[] }) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useLayoutEffect(() => {
    if (!cards.length || !layerRef.current) {
      return;
    }

    const context = gsap.context(() => {
      tlRef.current?.kill();
      tlRef.current = gsap.timeline();

      cards.forEach((card, index) => {
        const shell = layerRef.current?.querySelector<HTMLElement>(`[data-return-flight-card-id="${card.id}"]`);

        if (!shell || !layerRef.current) {
          return;
        }

        const targetSelector = card.selfCard ? `[data-return-target="self:${card.targetIndex}"]` : `[data-return-target="${card.playerId}:${card.targetIndex}"]`;
        const targetNode = document.querySelector<HTMLElement>(targetSelector);
        const targetPose = getDealFlightTargetPose(targetNode, shell, layerRef.current);
        const arc = getDealFlightArc(index, card.selfCard);

        gsap.set(shell, {
          xPercent: -50,
          yPercent: -50,
          x: card.startX,
          y: card.startY,
          rotate: card.startRotate,
          opacity: 0,
          scale: 1,
        });

        tlRef.current?.fromTo(
          shell,
          {
            xPercent: -50,
            yPercent: -50,
            x: card.startX,
            y: card.startY,
            rotate: card.startRotate,
            opacity: 0,
            scale: 1,
          },
          {
            xPercent: -50,
            yPercent: -50,
            x: targetPose.x * 0.58 + arc.midX,
            y: targetPose.y * 0.52 + arc.midY,
            rotate: targetPose.rotate + arc.settleRotate,
            opacity: targetPose.visible ? 1 : 0.4,
            scale: Math.max(0.82, Math.min(1.08, targetPose.scale * 1.04)),
            filter: "drop-shadow(0 9px 10px rgba(8, 13, 14, 0.24))",
            duration: DISCARD_RETURN_FLIGHT_SECONDS * 0.34,
            ease: "power2.out",
          },
          index * DISCARD_RETURN_STAGGER_SECONDS,
        );

        tlRef.current?.to(
          shell,
          {
            x: targetPose.x + arc.overshootX,
            y: targetPose.y + arc.overshootY,
            rotate: targetPose.rotate - arc.settleRotate * 0.35,
            scale: targetPose.scale * 1.02,
            opacity: targetPose.visible ? 1 : 0,
            filter: "drop-shadow(0 5px 6px rgba(8, 13, 14, 0.22))",
            duration: DISCARD_RETURN_FLIGHT_SECONDS * 0.42,
            ease: "power3.in",
          },
          index * DISCARD_RETURN_STAGGER_SECONDS + DISCARD_RETURN_FLIGHT_SECONDS * 0.34,
        );

        tlRef.current?.to(
          shell,
          {
            x: targetPose.x,
            y: targetPose.y,
            rotate: targetPose.rotate,
            scale: targetPose.scale,
            opacity: targetPose.visible ? 1 : 0,
            filter: "drop-shadow(0 3px 4px rgba(8, 13, 14, 0.2))",
            duration: DISCARD_RETURN_FLIGHT_SECONDS * 0.24,
            ease: "back.out(1.8)",
          },
          index * DISCARD_RETURN_STAGGER_SECONDS + DISCARD_RETURN_FLIGHT_SECONDS * 0.76,
        );
      });
    }, layerRef);

    return () => {
      context.revert();
      tlRef.current?.kill();
      tlRef.current = null;
    };
  }, [cards]);

  return (
    <div ref={layerRef} className="lie-return-flight-layer" aria-hidden>
      {cards.map((card) => (
        <div
          key={card.id}
          data-return-flight-card-id={card.id}
          className="lie-return-flight-shell"
          style={
            {
              zIndex: card.zIndex,
            } as CSSProperties
          }
        >
          {card.selfCard ? (
            <DomPlayingCard
              card={card.selfCard}
              label="飞回手牌的牌"
              className="lie-return-flight-card [--pixel-card-scale:1.55]"
            />
          ) : (
            <CardBackArt
              back={card.cardBack}
              label="飞回手牌的牌背"
              className="lie-return-flight-card [--card-back-art-height:65px] [--card-back-art-width:49px] [--card-back-scale:1.55]"
            />
          )}
        </div>
      ))}
    </div>
  );
}

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
 * @param onPlayCards 出牌或确认待定胜利回调。
 * @param onChallenge 质疑回调。
 * @param busy 当前房间操作是否正在提交。
 * @return 游戏牌桌组件。
 *
 * @Date 2026-06-12 14:47
 */
export default function GameTable({
  state,
  events: _events,
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
  events: PublicGameEvent[];
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
    startNextDealFlight,
    visibleCardCounts,
  } = useDealAnimation(state, selfPlayerId);
  const [declareModalOpen, setDeclareModalOpen] = useState(false);
  const [returnFlights, setReturnFlights] = useState<ReturnFlightCard[]>([]);
  const [returnTargetSelfCards, setReturnTargetSelfCards] = useState<Card[]>([]);
  const [returnTargetCardCounts, setReturnTargetCardCounts] = useState<VisibleCardCounts>({});
  const previousDiscardCardsRef = useRef<PublicDiscardCard[]>(state.discardPileCards);
  const opponents = useMemo(
    () => [...state.players].sort((left, right) => left.seatIndex - right.seatIndex).filter((player) => player.playerId !== selfPlayerId),
    [selfPlayerId, state.players],
  );
  const selfVisibleCardCount = selfPlayerId ? (visibleCardCounts[selfPlayerId] ?? state.selfHand.length) : state.selfHand.length;
  const activeSelfFlightTargetIndex = dealing
    ? Math.max(
        -1,
        ...dealFlights
          .filter((flight) => flight.playerId === selfPlayerId && flight.selfCard)
          .map((flight) => flight.targetIndex),
      )
    : -1;
  const visibleSelfHand = dealing ? selfDealCards.slice(0, selfVisibleCardCount) : state.selfHand;
  const dealTargetSelfHand = dealing && activeSelfFlightTargetIndex >= 0 ? selfDealCards.slice(0, activeSelfFlightTargetIndex + 1) : visibleSelfHand;
  const returnVisibleSelfHand =
    returnTargetSelfCards.length > 0
      ? state.selfHand.filter((card) => !returnTargetSelfCards.some((targetCard) => targetCard.id === card.id))
      : visibleSelfHand;

  useEffect(() => {
    const previousDiscardCards = previousDiscardCardsRef.current;
    previousDiscardCardsRef.current = state.discardPileCards;

    if (!previousDiscardCards.length || state.discardPileCards.length) {
      return;
    }

    const targetPlayerId = state.currentPlayerId;
    const returnToSelf = targetPlayerId === selfPlayerId;
    const returnedSelfCards = returnToSelf ? state.selfHand.slice(Math.max(0, state.selfHand.length - previousDiscardCards.length)) : [];
    const currentTargetPlayer = state.players.find((player) => player.playerId === targetPlayerId);
    const returnTargetCardCount = currentTargetPlayer?.cardCount ?? previousDiscardCards.length;
    const firstReturnTargetIndex = Math.max(0, returnTargetCardCount - previousDiscardCards.length);
    const batchId = Date.now();
    const nextFlights = previousDiscardCards.map((card, index) => {
      const startPose = getScatteredDiscardPose(index);

      return {
        id: `${state.turnSeq}-${card.playedByPlayerId}-${index}-${batchId}`,
        cardBack: card.cardBack,
        playerId: targetPlayerId,
        selfCard: returnedSelfCards[index],
        startX: startPose.x,
        startY: startPose.y,
        startRotate: startPose.rotate,
        targetIndex: firstReturnTargetIndex + index,
        zIndex: previousDiscardCards.length - index,
      };
    });

    const startTimer = window.setTimeout(() => {
      setReturnTargetSelfCards(returnToSelf ? state.selfHand : []);
      setReturnTargetCardCounts(returnToSelf ? {} : { [targetPlayerId]: returnTargetCardCount });
      setReturnFlights((current) => [...current, ...nextFlights]);
    }, 0);
    const endTimer = window.setTimeout(
      () => {
        setReturnFlights((current) => current.filter((card) => !nextFlights.some((flight) => flight.id === card.id)));
        setReturnTargetSelfCards([]);
        setReturnTargetCardCounts({});
      },
      (nextFlights.length - 1) * DISCARD_RETURN_STAGGER_SECONDS * 1000 + DISCARD_RETURN_FLIGHT_SECONDS * 1000 + 160,
    );

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(endTimer);
    };
  }, [selfPlayerId, state.currentPlayerId, state.discardPileCards, state.players, state.selfHand, state.turnSeq]);

  function handlePlayButtonClick() {
    if (resolvingPendingWin) {
      onPlayCards();
      return;
    }

    if (followRank) {
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
    <div className="lie-game-table relative grid h-full max-h-dvh min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-2 overflow-hidden px-3 py-2 sm:gap-4 sm:px-4 sm:py-4 xl:px-1">
      <section className="grid min-h-0 grid-cols-2 gap-2 sm:gap-3">
        {opponents.map((player) => (
          <PlayerSeat
            key={player.playerId}
            player={{
              ...player,
              cardCount: dealing ? (visibleCardCounts[player.playerId] ?? 0) : player.cardCount,
            }}
            active={player.playerId === state.currentPlayerId}
            dealing={dealing}
            dealTargetCardCount={dealing ? player.cardCount : undefined}
            owner={Boolean(ownerUserId && player.userId === ownerUserId)}
            returnTargetCardCount={returnTargetCardCounts[player.playerId]}
          />
        ))}
      </section>

      <div className="lie-table-surface">
        <TableStatusPanel followRank={followRank} lastPlayCardCount={state.lastPlay?.cardCount} />
        <DealFlightLayer
          flights={dealFlights}
          onFlightComplete={completeDealFlight}
          onFlightReadyForNext={startNextDealFlight}
          remainingDeckCount={remainingDeckCount}
        />
        <DiscardPile cards={state.discardPileCards} players={state.players} selfPlayerId={selfPlayerId} />
        <ReturnFlightLayer cards={returnFlights} />
      </div>

      <section className="grid min-h-0 gap-2 sm:gap-3">
        {isSelfTurn ? (
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
            <div className={`grid w-full max-w-[22rem] gap-2 sm:w-auto ${canChallenge ? "grid-cols-2 sm:min-w-[20rem]" : "sm:min-w-[10rem]"}`}>
              <PixelButton
                onClick={handlePlayButtonClick}
                disabled={busy || dealing || !canPlay || (!resolvingPendingWin && (selectedCardIds.length < 1 || selectedCardIds.length > 4))}
                variant="primary"
                className="w-full"
              >
                <Swords size={17} />
                {resolvingPendingWin ? "不质疑，确认获胜" : followRank ? "跟牌" : "出牌"}
              </PixelButton>
              {canChallenge ? (
                <PixelButton
                  onClick={onChallenge}
                  disabled={busy || dealing}
                  variant="ghost"
                  className="w-full"
                >
                  <ThumbsDown size={17} />
                  质疑
                </PixelButton>
              ) : null}
            </div>
          </div>
        ) : null}
        {resolvingPendingWin ? (
          <p className="text-sm text-[#c6b889]">上一手玩家已打空手牌。你可以质疑；如果不质疑，点击主按钮会直接确认其获胜。</p>
        ) : null}
        <Hand
          cards={returnVisibleSelfHand}
          dealing={dealing}
          dealTargetCards={dealing ? dealTargetSelfHand : undefined}
          returnTargetCards={returnTargetSelfCards.length ? returnTargetSelfCards : undefined}
          disabled={!isSelfTurn || dealing || state.status === "finished"}
          selectedCardIds={selectedCardIds}
          onToggleCard={onToggleCard}
          onSetCardSelected={onSetCardSelected}
        />
      </section>

      {declareModalOpen && !followRank ? (
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
