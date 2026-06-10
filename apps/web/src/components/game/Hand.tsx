/**
 * 手牌区域组件：以无面板的堆叠牌列展示本地玩家可见的真实手牌。
 */
"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import type { Card as CardType } from "@lie/shared";
import Card from "./Card";

const CARD_BASE_WIDTH = 49;
const HAND_CARD_MAX_SCALE = 3.05;
const HAND_CARD_MIN_SCALE = 1.05;
const HAND_CARD_TARGET_OVERLAP = 82;

const handCardPoseList = [
  { rotate: -3, y: 0.24 },
  { rotate: -2, y: 0.12 },
  { rotate: -1, y: 0.04 },
  { rotate: 1, y: -0.03 },
  { rotate: 2, y: 0 },
  { rotate: 2, y: 0.08 },
  { rotate: 3, y: 0.16 },
  { rotate: -1, y: 0.06 },
  { rotate: 3, y: 0.22 },
] as const;

function getHandScale(containerWidth: number, cardCount: number) {
  if (!containerWidth || cardCount < 1) {
    return 1;
  }

  if (cardCount === 1) {
    return HAND_CARD_MAX_SCALE;
  }

  const fittedScale = (containerWidth + HAND_CARD_TARGET_OVERLAP * (cardCount - 1)) / (CARD_BASE_WIDTH * cardCount);

  return Math.min(Math.max(fittedScale, HAND_CARD_MIN_SCALE), HAND_CARD_MAX_SCALE);
}

function getHandOverlap(scale: number, cardCount: number) {
  if (cardCount <= 1) {
    return 0;
  }

  return Math.min(HAND_CARD_TARGET_OVERLAP, CARD_BASE_WIDTH * scale * 0.72);
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
  const handScale = getHandScale(handWidth, cards.length);
  const handOverlap = getHandOverlap(handScale, cards.length);

  useEffect(() => {
    const hand = handRef.current;
    if (!hand) {
      return;
    }

    const updateHandWidth = () => setHandWidth(hand.clientWidth);
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
                "--hand-card-overlap": `${handOverlap}px`,
                "--pixel-card-scale": handScale,
              } as CSSProperties
            }
          >
            {cards.map((card, index) => {
              const pose = handCardPoseList[index % handCardPoseList.length];

              return (
                <Card
                  key={card.id}
                  card={card}
                  selected={selectedCardIds.includes(card.id)}
                  onClick={() => onToggleCard(card.id)}
                  style={
                    {
                      "--hand-card-rotate": `${pose.rotate}deg`,
                      "--hand-card-y": `${pose.y}rem`,
                    } as CSSProperties
                  }
                />
              );
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
