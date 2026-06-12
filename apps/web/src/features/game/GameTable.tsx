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
import Hand from "./Hand";
import PlayerSeat from "./PlayerSeat";

type GamePlayer = PublicGameState["players"][number];
type PublicDiscardCard = PublicGameState["discardPileCards"][number];
type TableHistoryEvent = Extract<PublicGameEvent, { type: "cards_played" | "challenge_resolved" }>;
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
  startX: number;
  startY: number;
  startRotate: number;
  targetX: number;
  targetY: string;
  targetRotate: number;
  zIndex: number;
};

type DiscardGroupMeta = {
  cardIndex: number;
  cardCount: number;
  groupIndex: number;
};

const DISCARD_CARD_STAGGER_SECONDS = 0.086;
const DISCARD_CARD_FLIGHT_SECONDS = 0.52;
const DISCARD_RETURN_STAGGER_SECONDS = 0.058;
const DISCARD_RETURN_FLIGHT_SECONDS = 0.62;
const DEAL_CARD_STAGGER_SECONDS = 0.075;
const DEAL_CARD_FLIGHT_SECONDS = 0.5;

function getTargetCardCounts(players: GamePlayer[]) {
  return Object.fromEntries(players.map((player) => [player.playerId, player.cardCount])) as VisibleCardCounts;
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
    const selfDealCards = [...state.selfHand];
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
    setDealFlights(currentDealPlan.flights);

    const endTimer = window.setTimeout(
      () => {
        completedDealMatchIdRef.current = currentDealPlan.matchId;
        setVisibleCardCounts(currentDealPlan.targetCounts);
        setRemainingDeckCount(0);
        setDealFlights([]);
        setDealing(false);
      },
      currentDealPlan.flights.length * DEAL_CARD_STAGGER_SECONDS * 1000 + DEAL_CARD_FLIGHT_SECONDS * 1000 + 120,
    );

    return () => window.clearTimeout(endTimer);
  }, [dealPlan.key]);

  const completeDealFlight = useCallback((flight: DealFlightCard) => {
    setVisibleCardCounts((current) => ({
      ...current,
      [flight.playerId]: (current[flight.playerId] ?? 0) + 1,
    }));
    setRemainingDeckCount((current) => Math.max(0, current - 1));
  }, []);

  return { completeDealFlight, dealFlights, remainingDeckCount, visibleCardCounts, dealing };
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

/**
 * @Description: 计算质疑结算后弃牌堆飞回失败方手牌区的目标位置。
 *
 * @param playerId 拿走弃牌堆的玩家 ID。
 * @param players 当前公开玩家列表。
 * @param selfPlayerId 当前玩家 ID。
 * @return 飞回动画目标位移和旋转角。
 *
 * @Date 2026-06-12 14:47
 */
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

function getPlayerName(playerId: string, playerNameById: Map<string, string>) {
  return playerNameById.get(playerId) ?? "玩家";
}

function formatCardCount(count: number) {
  const countLabels = ["零", "一", "两", "三", "四"] as const;

  return `${countLabels[count] ?? count}张`;
}

function formatTableHistoryEvent(event: TableHistoryEvent, playerNameById: Map<string, string>) {
  if (event.type === "cards_played") {
    const actorName = getPlayerName(event.actorPlayerId, playerNameById);
    const action = event.playMode === "follow" ? "跟" : "声明";

    return `${actorName}，${action}${formatCardCount(event.cardCount)}${event.declaredRank}`;
  }

  const challengerName = getPlayerName(event.challengerPlayerId, playerNameById);
  const challengedName = getPlayerName(event.challengedPlayerId, playerNameById);

  return `${challengerName}，质疑${challengedName}${event.wasTruthful ? "失败" : "成功"}`;
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
          filter: isSelfCard ? "drop-shadow(0 16px 0 rgba(8, 13, 14, 0.22))" : "drop-shadow(0 14px 0 rgba(8, 13, 14, 0.2))",
        },
          {
            x: 0,
            y: 0,
            rotate: 0,
            scale: 1,
            opacity: 1,
            filter: "drop-shadow(0 0 0 rgba(8, 13, 14, 0))",
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

function TableStatusPanel({ discardPileCount, followRank }: { discardPileCount: number; followRank: DeclaredRank | null }) {
  return (
    <aside className="lie-table-status-panel" aria-label="当前牌桌状态">
      <div>
        <span className="lie-table-status-label">当前点数</span>
        <strong>{followRank ?? "待声明"}</strong>
      </div>
      <div>
        <span className="lie-table-status-label">弃牌区</span>
        <strong>{discardPileCount} 张</strong>
      </div>
    </aside>
  );
}

function TableHistoryPanel({ events, players }: { events: PublicGameEvent[]; players: GamePlayer[] }) {
  const playerNameById = useMemo(() => new Map(players.map((player) => [player.playerId, player.nickname])), [players]);
  const historyEvents = events.filter((event): event is TableHistoryEvent => event.type === "cards_played" || event.type === "challenge_resolved");

  return (
    <aside className="lie-table-history-panel" aria-label="出牌历史">
      {historyEvents.length ? (
        historyEvents
          .slice(-9)
          .reverse()
          .map((event, index) => (
            <div key={`${event.type}-${event.turnSeq}-${index}`} className="lie-table-history-item">
              {formatTableHistoryEvent(event, playerNameById)}
            </div>
          ))
      ) : (
        <div className="lie-table-history-empty">等待第一手牌</div>
      )}
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
}: {
  flights: DealFlightCard[];
  onFlightComplete: (flight: DealFlightCard) => void;
  remainingDeckCount: number;
}) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const completedFlightIdsRef = useRef(new Set<string>());

  useLayoutEffect(() => {
    completedFlightIdsRef.current.clear();

    if (!flights.length || !layerRef.current) {
      return;
    }

    const context = gsap.context(() => {
      flights.forEach((flight) => {
        const shell = layerRef.current?.querySelector<HTMLElement>(`[data-deal-flight-card-id="${flight.id}"]`);
        const flipper = shell?.querySelector<HTMLElement>("[data-deal-flight-flipper]");

        if (!shell || !layerRef.current) {
          return;
        }

        const layerBounds = layerRef.current.getBoundingClientRect();
        const originX = layerBounds.left + layerBounds.width / 2;
        const originY = layerBounds.top + layerBounds.height * 0.55;
        const targetSelector = flight.selfCard ? `[data-hand-card-id="${flight.selfCard.id}"]` : `[data-deal-target="${flight.playerId}:${flight.targetIndex}"]`;
        const targetNode = document.querySelector<HTMLElement>(targetSelector);
        const targetBounds = targetNode?.getBoundingClientRect();
        const shellBounds = shell.getBoundingClientRect();
        const targetX = targetBounds ? targetBounds.left + targetBounds.width / 2 - originX : 0;
        const targetY = targetBounds ? targetBounds.top + targetBounds.height / 2 - originY : "20rem";
        const targetScale = targetBounds ? Math.max(0.62, Math.min(1.08, targetBounds.width / Math.max(shellBounds.width, 1))) : 0.96;

        gsap.fromTo(
          shell,
          {
            x: 0,
            y: 0,
            rotate: -6 + (flight.orderIndex % 5) * 3,
            scale: 1,
            opacity: 0,
          },
          {
            x: targetX,
            y: targetY,
            rotate: 0,
            scale: targetScale,
            opacity: targetBounds ? 1 : 0,
            duration: DEAL_CARD_FLIGHT_SECONDS,
            ease: "power3.inOut",
            delay: flight.orderIndex * DEAL_CARD_STAGGER_SECONDS,
            onComplete: () => {
              if (completedFlightIdsRef.current.has(flight.id)) {
                return;
              }

              completedFlightIdsRef.current.add(flight.id);
              gsap.set(shell, { opacity: 0 });
              onFlightComplete(flight);
            },
          },
        );

        if (flight.selfCard && flipper) {
          gsap.to(flipper, {
            rotateY: 180,
            duration: 0.28,
            ease: "power2.inOut",
            delay: flight.orderIndex * DEAL_CARD_STAGGER_SECONDS + 0.12,
          });
        }
      });
    }, layerRef);

    return () => context.revert();
  }, [flights, onFlightComplete]);

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
          <span data-deal-flight-flipper className="lie-deal-flight-flipper">
            <CardBackArt
              back={flight.cardBack}
              label="发牌中的牌背"
              className="lie-deal-flight-side lie-deal-flight-back [--card-back-art-height:65px] [--card-back-art-width:49px] [--card-back-scale:1.55]"
            />
            {flight.selfCard ? (
              <DomPlayingCard
                card={flight.selfCard}
                label="发到你手中的牌"
                className="lie-deal-flight-side lie-deal-flight-front [--pixel-card-scale:1.55]"
              />
            ) : null}
          </span>
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

        if (!shell) {
          return;
        }

        const cardNode = shell.querySelector<HTMLElement>("[data-return-flight-card-body]");

        gsap.set(shell, {
          x: card.startX,
          y: card.startY,
          rotate: card.startRotate,
          opacity: 0,
        });

        gsap.set(cardNode, {
          x: 0,
          y: 0,
          rotate: 0,
          scale: 1,
        });

        tlRef.current?.fromTo(
          shell,
          {
            x: card.startX,
            y: card.startY,
            rotate: card.startRotate,
            opacity: 0,
          },
          {
            x: card.targetX,
            y: card.targetY,
            rotate: card.targetRotate,
            opacity: 1,
            duration: DISCARD_RETURN_FLIGHT_SECONDS,
            ease: "power3.out",
          },
          index * DISCARD_RETURN_STAGGER_SECONDS,
        );

        tlRef.current?.to(
          cardNode,
          {
            x: index * 0.95 - ((cards.length - 1) * 0.95) / 2,
            y: index * -0.55,
            rotate: (index - (cards.length - 1) / 2) * 0.5,
            scale: 0.94,
            duration: 0.12,
            ease: "power1.out",
          },
          index * DISCARD_RETURN_STAGGER_SECONDS + DISCARD_RETURN_FLIGHT_SECONDS - 0.1,
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
          <CardBackArt
            back={card.cardBack}
            label="飞回手牌的牌背"
            data-return-flight-card-body
            className="lie-return-flight-card [--card-back-art-height:65px] [--card-back-art-width:49px] [--card-back-scale:1.55]"
          />
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
  events,
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
  const { completeDealFlight, dealFlights, remainingDeckCount, visibleCardCounts, dealing } = useDealAnimation(state, selfPlayerId);
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
    const batchId = Date.now();
    const nextFlights = previousDiscardCards.map((card, index) => {
      const startPose = getScatteredDiscardPose(index);

      return {
        id: `${state.turnSeq}-${card.playedByPlayerId}-${index}-${batchId}`,
        cardBack: card.cardBack,
        startX: startPose.x,
        startY: startPose.y,
        startRotate: startPose.rotate,
        targetX: target.x,
        targetY: target.y,
        targetRotate: target.rotate,
        zIndex: previousDiscardCards.length - index,
      };
    });

    const startTimer = window.setTimeout(() => {
      setReturnFlights((current) => [...current, ...nextFlights]);
    }, 0);
    const endTimer = window.setTimeout(
      () => {
        setReturnFlights((current) => current.filter((card) => !nextFlights.some((flight) => flight.id === card.id)));
      },
      (nextFlights.length - 1) * DISCARD_RETURN_STAGGER_SECONDS * 1000 + DISCARD_RETURN_FLIGHT_SECONDS * 1000 + 160,
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
          />
        ))}
      </section>

      <div className="lie-table-surface">
        <TableStatusPanel discardPileCount={state.discardPileCount} followRank={followRank} />
        <DealFlightLayer
          flights={dealFlights}
          onFlightComplete={completeDealFlight}
          remainingDeckCount={remainingDeckCount}
        />
        <DiscardPile cards={state.discardPileCards} players={state.players} selfPlayerId={selfPlayerId} />
        <ReturnFlightLayer cards={returnFlights} />
        <TableHistoryPanel events={events} players={state.players} />
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
          cards={visibleSelfHand}
          dealing={dealing}
          dealTargetCards={dealing ? state.selfHand : undefined}
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
