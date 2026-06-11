/**
 * 手牌区域组件：以无面板的堆叠牌列展示本地玩家可见的真实手牌。
 */
"use client";

import type { CSSProperties, PointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { isJokerRank, sortHandCards, type Card as CardType, type StandardSuit } from "@lie/shared";
import Card from "./Card";

const CARD_BASE_WIDTH = 49;
const CARD_BASE_HEIGHT = 65;
const HAND_CARD_MAX_SCALE = 2.35;
const HAND_CARD_MIN_SCALE = 0.88;
const HAND_GROUP_STEP = 9;
const HAND_STACK_STEP = 16;
const HAND_FAN_MAX_ROTATE = 14;
const HAND_FAN_MAX_LIFT = 12;
const suitStackWeight = new Map<StandardSuit, number>([
  ["D", 0],
  ["C", 1],
  ["H", 2],
  ["S", 3],
]);

type HandGroup = {
  key: string;
  cards: CardType[];
};

type DragSelectionState = {
  pointerId: number;
  selecting: boolean;
  visitedCardIds: Set<string>;
};

function getCardIdFromTarget(target: EventTarget | Element | null) {
  return target instanceof Element ? (target.closest<HTMLElement>("[data-hand-card-id]")?.dataset.handCardId ?? null) : null;
}

function getHandGroupKey(card: CardType) {
  return isJokerRank(card.rank) ? "JOKER" : card.rank;
}

function sortStackCards(cards: CardType[]) {
  if (cards.some((card) => isJokerRank(card.rank))) {
    return [...cards].sort((left, right) => (left.rank === "RED_JOKER" ? 0 : 1) - (right.rank === "RED_JOKER" ? 0 : 1));
  }

  return [...cards].sort(
    (left, right) => (suitStackWeight.get(left.suit as StandardSuit) ?? 0) - (suitStackWeight.get(right.suit as StandardSuit) ?? 0),
  );
}

function groupHandCards(cards: CardType[]) {
  const groups = new Map<string, HandGroup>();

  for (const card of sortHandCards(cards)) {
    const key = getHandGroupKey(card);
    const group = groups.get(key);

    if (group) {
      group.cards.push(card);
      continue;
    }

    groups.set(key, {
      key,
      cards: [card],
    });
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    cards: sortStackCards(group.cards),
  }));
}

function getHandScale(containerWidth: number, groupCount: number) {
  if (!containerWidth || groupCount < 1) {
    return 1;
  }

  if (groupCount <= 2) {
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

function getHandHeight(scale: number, maxStackSize: number) {
  return CARD_BASE_HEIGHT * scale + (HAND_FAN_MAX_LIFT + HAND_STACK_STEP * Math.max(0, maxStackSize - 1)) * scale + 44;
}

function getFanProgress(groupIndex: number, groupCount: number) {
  if (groupCount <= 1) {
    return 0;
  }

  const center = (groupCount - 1) / 2;
  const distanceFromCenter = Math.abs(groupIndex - center) / Math.max(center, 1);
  return 1 - distanceFromCenter;
}

function getFanRotate(groupIndex: number, groupCount: number) {
  if (groupCount <= 1) {
    return 0;
  }

  const center = (groupCount - 1) / 2;
  return ((groupIndex - center) / center) * HAND_FAN_MAX_ROTATE;
}

function getFanLift(groupIndex: number, groupCount: number, scale: number) {
  return Math.sin((getFanProgress(groupIndex, groupCount) * Math.PI) / 2) * HAND_FAN_MAX_LIFT * scale;
}

function getStackOffset(rotate: number, stackIndex: number, scale: number) {
  const distance = stackIndex * HAND_STACK_STEP * scale;
  const radians = (rotate * Math.PI) / 180;

  return {
    x: Math.sin(radians) * distance,
    y: Math.cos(radians) * distance,
  };
}

export default function Hand({
  cards,
  dealing = false,
  selectedCardIds,
  onToggleCard,
  onSetCardSelected,
}: {
  cards: CardType[];
  dealing?: boolean;
  selectedCardIds: string[];
  onToggleCard: (cardId: string) => void;
  onSetCardSelected: (cardId: string, selected: boolean) => void;
}) {
  const handRef = useRef<HTMLDivElement>(null);
  const dragSelectionRef = useRef<DragSelectionState | null>(null);
  const [handWidth, setHandWidth] = useState(0);
  const handGroups = groupHandCards(cards);
  const maxStackSize = handGroups.reduce((maxSize, group) => Math.max(maxSize, group.cards.length), 1);
  const handScale = getHandScale(handWidth, handGroups.length);
  const handEdgePadding = getHandEdgePadding(handWidth);
  const handHeight = getHandHeight(handScale, maxStackSize);

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

  function applyDraggedCard(cardId: string, dragSelection: DragSelectionState) {
    if (dragSelection.visitedCardIds.has(cardId)) {
      return;
    }

    dragSelection.visitedCardIds.add(cardId);
    onSetCardSelected(cardId, dragSelection.selecting);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const cardId = getCardIdFromTarget(event.target);
    if (!cardId) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const dragSelection = {
      pointerId: event.pointerId,
      selecting: !selectedCardIds.includes(cardId),
      visitedCardIds: new Set<string>(),
    };
    dragSelectionRef.current = dragSelection;
    applyDraggedCard(cardId, dragSelection);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const dragSelection = dragSelectionRef.current;
    if (!dragSelection || dragSelection.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();

    const cardId = getCardIdFromTarget(document.elementFromPoint(event.clientX, event.clientY));
    if (cardId) {
      applyDraggedCard(cardId, dragSelection);
    }
  }

  function finishPointerSelection(event: PointerEvent<HTMLDivElement>) {
    const dragSelection = dragSelectionRef.current;
    if (!dragSelection || dragSelection.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragSelectionRef.current = null;
  }

  return (
    <div className="grid gap-1">
      {cards.length ? (
        <>
          <div
            ref={handRef}
            className="lie-game-hand"
            aria-label="你的手牌"
            onPointerCancel={finishPointerSelection}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishPointerSelection}
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
              const groupLift = getFanLift(groupIndex, handGroups.length, handScale);

              return group.cards.map((card, stackIndex) => {
                const stackOffset = getStackOffset(rotate, stackIndex, handScale);
                const upwardOffset = groupLift + stackOffset.y;

                return (
                  <Card
                    key={card.id}
                    card={card}
                    dealing={dealing}
                    selected={selectedCardIds.includes(card.id)}
                    onKeyboardToggle={() => onToggleCard(card.id)}
                    style={
                      {
                        "--hand-card-x": `${groupX + stackOffset.x}px`,
                        "--hand-card-y": `${-upwardOffset}px`,
                        "--hand-card-rotate": `${rotate}deg`,
                        zIndex: groupIndex * (maxStackSize + 1) + (maxStackSize - stackIndex),
                      } as CSSProperties
                    }
                  />
                );
              });
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
