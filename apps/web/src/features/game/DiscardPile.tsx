/**
 * @Description: 弃牌堆展示组件，负责出牌飞入、散牌堆叠和质疑时原地翻开牌面。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from "react";
import { gsap } from "gsap";
import CardBackArt from "@/components/cards/CardBackArt";
import DomPlayingCard from "@/components/cards/DomPlayingCard";
import { DISCARD_CARD_FLIGHT_SECONDS, DISCARD_CARD_STAGGER_SECONDS, DISCARD_POSE_PATTERN } from "./gameTableConstants";
import type { DiscardGroupMeta, DisplayDiscardCard, GamePlayer, PublicDiscardCard } from "./gameTableTypes";

function getDiscardGroupKey(card: DisplayDiscardCard) {
  return `${card.turnSeq}:${card.playedByPlayerId}`;
}

function getDiscardCardId(card: DisplayDiscardCard, index: number) {
  return `${card.turnSeq}-${card.playedByPlayerId}-${index}`;
}

/**
 * @Description: 按出牌 turnSeq 与玩家分组弃牌堆，保证同一手多张牌以小堆形式一起飞入。
 *
 * @param cards 当前公开弃牌堆牌背列表。
 * @return 每张牌对应的组内位置和总组数。
 *
 * @Date 2026-06-12 14:47
 */
function getDiscardGroupMeta(cards: DisplayDiscardCard[]) {
  const groups = new Map<string, DisplayDiscardCard[]>();
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

  const metaByCard = new WeakMap<DisplayDiscardCard, DiscardGroupMeta>();

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

export function getScatteredDiscardPose(index: number) {
  const pattern = DISCARD_POSE_PATTERN[index % DISCARD_POSE_PATTERN.length];
  const lap = Math.floor(index / DISCARD_POSE_PATTERN.length);
  const lapDirection = lap % 2 === 0 ? 1 : -1;
  const x = pattern.x + lapDirection * Math.min(24, lap * 5);
  const y = pattern.y + ((lap * 13) % 25) - 12;
  const rotate = pattern.rotate + lapDirection * Math.min(18, lap * 4);

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
    return { x: 0, y: "17rem", rotate: -13 };
  }

  const opponents = players
    .filter((player) => player.playerId !== selfPlayerId)
    .sort((left, right) => left.seatIndex - right.seatIndex);
  const opponentIndex = Math.max(0, opponents.findIndex((player) => player.playerId === card.playedByPlayerId));

  return {
    x: opponentIndex === 0 ? -178 : 178,
    y: "-13rem",
    rotate: opponentIndex === 0 ? -16 : 16,
  };
}

export default function DiscardPile({
  animateEnter = true,
  cards,
  players,
  selfPlayerId,
}: {
  animateEnter?: boolean;
  cards: DisplayDiscardCard[];
  players: GamePlayer[];
  selfPlayerId?: string | null;
}) {
  const pileRef = useRef<HTMLDivElement | null>(null);
  const animatedCardIdsRef = useRef(new Set<string>());
  const discardTweensRef = useRef(new Map<string, gsap.core.Animation>());
  const visibleCards = useMemo(() => cards.slice(-48), [cards]);
  const { metaByCard } = useMemo(() => getDiscardGroupMeta(cards), [cards]);

  useLayoutEffect(() => {
    if (!visibleCards.length) {
      discardTweensRef.current.forEach((tween) => tween.kill());
      discardTweensRef.current.clear();
      return;
    }

    if (!pileRef.current) {
      return;
    }

    const visibleCardIds = new Set(visibleCards.map((card, index) => getDiscardCardId(card, cards.length - visibleCards.length + index)));

    discardTweensRef.current.forEach((tween, cardId) => {
      if (!visibleCardIds.has(cardId)) {
        tween.kill();
        discardTweensRef.current.delete(cardId);
        animatedCardIdsRef.current.delete(cardId);
      }
    });

    visibleCards.forEach((card, index) => {
      const cardId = getDiscardCardId(card, cards.length - visibleCards.length + index);

      if (animatedCardIdsRef.current.has(cardId)) {
        return;
      }

      const shell = pileRef.current?.querySelector<HTMLElement>(`[data-discard-card-id="${cardId}"]`);

      if (!shell) {
        return;
      }

      const meta = metaByCard.get(card) ?? { cardIndex: 0, cardCount: 1, groupIndex: index };
      if (!animateEnter) {
        animatedCardIdsRef.current.add(cardId);
        gsap.set(shell, { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1, filter: "drop-shadow(0 2px 3px rgba(8, 13, 14, 0.18))" });
        return;
      }

      const flightStart = getDiscardFlightStart(card, players, selfPlayerId);
      const flightStackOffset = meta.cardIndex - (meta.cardCount - 1) / 2;
      const isSelfCard = card.playedByPlayerId === selfPlayerId;
      const startX = flightStart.x + flightStackOffset * 16;
      const startRotate = flightStart.rotate + flightStackOffset * 8;
      const landingDelay = meta.cardIndex * DISCARD_CARD_STAGGER_SECONDS;

      animatedCardIdsRef.current.add(cardId);
      gsap.set(shell, {
        x: startX,
        y: flightStart.y,
        rotate: startRotate,
        scale: isSelfCard ? 1.16 : 1.08,
        opacity: 0,
        filter: isSelfCard ? "drop-shadow(0 11px 14px rgba(8, 13, 14, 0.28))" : "drop-shadow(0 9px 12px rgba(8, 13, 14, 0.24))",
      });

      const tween = gsap.timeline({
        delay: landingDelay,
        onComplete: () => {
          discardTweensRef.current.delete(cardId);
        },
      });

      tween.to(shell, {
        x: 0,
        y: 0,
        rotate: 0,
        opacity: 1,
        scale: 1,
        filter: "drop-shadow(0 2px 3px rgba(8, 13, 14, 0.18))",
        duration: DISCARD_CARD_FLIGHT_SECONDS,
        ease: "expo.out",
      });

      tween.to(
        shell.firstElementChild,
        {
          y: -5,
          rotate: `${flightStackOffset * 3}deg`,
          duration: DISCARD_CARD_FLIGHT_SECONDS * 0.28,
          ease: "power2.out",
          yoyo: true,
          repeat: 1,
        },
        0,
      );

      tween.to(
        pileRef.current,
        {
          scale: 1.018,
          duration: 0.08,
          ease: "power1.out",
        },
        DISCARD_CARD_FLIGHT_SECONDS * 0.74,
      )
        .to(
          pileRef.current,
          {
            scale: 1,
            duration: 0.12,
            ease: "back.out(1.8)",
          },
          DISCARD_CARD_FLIGHT_SECONDS * 0.82,
        );

      discardTweensRef.current.set(cardId, tween);
    });
  }, [animateEnter, cards.length, metaByCard, players, selfPlayerId, visibleCards]);

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
        const pose = getScatteredDiscardPose(cards.length - visibleCards.length + index);
        const cardId = getDiscardCardId(card, cards.length - visibleCards.length + index);

        return (
          <div
            key={cardId}
            data-discard-card-id={cardId}
            className="lie-discard-pile-card-shell"
            style={
              {
                "--discard-card-x": `${pose.x}px`,
                "--discard-card-y": `${pose.y}px`,
                "--discard-card-rotate": `${pose.rotate}deg`,
                zIndex: cards.length - visibleCards.length + index,
              } as CSSProperties
            }
          >
            <div className="lie-discard-pile-card-pose">
              <div className="lie-discard-pile-card-flip" data-revealed={card.revealCard ? "true" : undefined}>
                <span className="lie-discard-pile-card-face lie-discard-pile-card-back">
                  <CardBackArt
                    back={card.cardBack}
                    label="弃牌堆中的牌背"
                    className="[--card-back-art-height:65px] [--card-back-art-width:49px] [--card-back-scale:1.55]"
                  />
                </span>
                {card.revealCard ? (
                  <span className="lie-discard-pile-card-face lie-discard-pile-card-front">
                    <DomPlayingCard
                      card={card.revealCard}
                      label="被质疑翻开的真实牌"
                      className="[--pixel-card-scale:1.55]"
                    />
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
