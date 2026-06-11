/**
 * 手牌区域组件：以无面板的堆叠牌列展示本地玩家可见的真实手牌。
 */
"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { RANKS, type Card as CardType, type Rank } from "@lie/shared";
import Card from "./Card";

const CARD_BASE_WIDTH = 49;
const CARD_BASE_HEIGHT = 65;
const HAND_CARD_MAX_SCALE = 2.35;
const HAND_CARD_MIN_SCALE = 0.88;
const HAND_GROUP_STEP = 32;
const HAND_STACK_STEP = 13;
const HAND_FAN_MAX_ROTATE = 15;
const rankOrderMap = new Map<Rank, number>(RANKS.map((rank, index) => [rank, index]));

type HandGroup = {
  rank: Rank;
  cards: CardType[];
};

function groupCardsByRank(cards: CardType[]) {
  const groups = new Map<Rank, CardType[]>();

  for (const card of cards) {
    groups.set(card.rank, [...(groups.get(card.rank) ?? []), card]);
  }

  return Array.from(groups.entries())
    .sort(([leftRank], [rightRank]) => (rankOrderMap.get(leftRank) ?? 0) - (rankOrderMap.get(rightRank) ?? 0))
    .map(([rank, groupCards]) => ({
      rank,
      cards: groupCards,
    }));
}

function getHandScale(containerWidth: number, groupCount: number, maxStackSize: number) {
  if (!containerWidth || groupCount < 1) {
    return 1;
  }

  if (groupCount === 1 && maxStackSize <= 2) {
    return HAND_CARD_MAX_SCALE;
  }

  const availableWidth = Math.max(containerWidth - getHandEdgePadding(containerWidth) * 2, CARD_BASE_WIDTH);
  const handBaseWidth = CARD_BASE_WIDTH + HAND_GROUP_STEP * Math.max(0, groupCount - 1);
  const fittedScale = availableWidth / handBaseWidth;

  return Math.min(Math.max(fittedScale, HAND_CARD_MIN_SCALE), HAND_CARD_MAX_SCALE);
}

function getHandEdgePadding(containerWidth: number) {
  return Math.min(Math.max(containerWidth * 0.064, 18), 30);
}

function getGroupedHandHeight(scale: number, maxStackSize: number) {
  return (CARD_BASE_HEIGHT + HAND_STACK_STEP * Math.max(0, maxStackSize - 1)) * scale + 48;
}

function getFanRotate(groupIndex: number, groupCount: number) {
  if (groupCount <= 1) {
    return 0;
  }

  const center = (groupCount - 1) / 2;
  return ((groupIndex - center) / center) * HAND_FAN_MAX_ROTATE;
}

function getFanLift(groupIndex: number, groupCount: number) {
  if (groupCount <= 1) {
    return 0;
  }

  const center = (groupCount - 1) / 2;
  const distanceFromCenter = Math.abs(groupIndex - center) / Math.max(center, 1);
  return (1 - distanceFromCenter) * 16;
}

export default function Hand({
  cards,
  selectedCardIds,
  onToggleCard,
}: {
  cards: CardType[];
  selectedCardIds: string[];
  onToggleCard: (cardId: string) => void;
}) {
  const handRef = useRef<HTMLDivElement>(null);
  const [handWidth, setHandWidth] = useState(0);
  const handGroups = groupCardsByRank(cards);
  const maxStackSize = handGroups.reduce((maxSize, group) => Math.max(maxSize, group.cards.length), 1);
  const handScale = getHandScale(handWidth, handGroups.length, maxStackSize);
  const handEdgePadding = getHandEdgePadding(handWidth);
  const handHeight = getGroupedHandHeight(handScale, maxStackSize);

  useEffect(() => {
    const hand = handRef.current;
    if (!hand) {
      return;
    }

    const updateHandWidth = () => {
      setHandWidth((currentWidth) => {
        const nextWidth = hand.clientWidth;
        return Math.abs(currentWidth - nextWidth) > 1 ? nextWidth : currentWidth;
      });
    };
    updateHandWidth();

    const observer = new ResizeObserver(updateHandWidth);
    observer.observe(hand);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="grid gap-1">
      {cards.length ? (
        <>
          <div
            ref={handRef}
            className="lie-game-hand"
            aria-label="你的手牌"
            style={
              {
                "--hand-edge-padding": `${handEdgePadding}px`,
                "--hand-height": `${handHeight}px`,
                "--pixel-card-scale": handScale,
              } as CSSProperties
            }
          >
            {handGroups.flatMap((group, groupIndex) => {
              const center = (handGroups.length - 1) / 2;
              const groupX = (groupIndex - center) * HAND_GROUP_STEP * handScale;
              const rotate = getFanRotate(groupIndex, handGroups.length);
              const lift = getFanLift(groupIndex, handGroups.length);

              return group.cards.map((card, stackIndex) => (
                <Card
                  key={card.id}
                  card={card}
                  selected={selectedCardIds.includes(card.id)}
                  onClick={() => onToggleCard(card.id)}
                  style={
                    {
                      "--hand-card-x": `${groupX}px`,
                      "--hand-card-y": `${-(lift + stackIndex * HAND_STACK_STEP * handScale)}px`,
                      "--hand-card-rotate": `${rotate}deg`,
                      zIndex: groupIndex * 10 + stackIndex,
                    } as CSSProperties
                  }
                />
              ));
            })}
          </div>
          <div className="text-center text-xs font-black tracking-[0.16em] text-[#f2df9e]">
            {cards.length}/{cards.length}
          </div>
        </>
      ) : (
        <div className="grid min-h-28 place-items-center text-sm text-[#c6b889]">没有手牌</div>
      )}
    </div>
  );
}
