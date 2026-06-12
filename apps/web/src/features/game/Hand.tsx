/**
 * @Description: 手牌区域组件：以无面板的堆叠牌列展示本地玩家可见的真实手牌。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import { Fragment, type CSSProperties, type PointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { isJokerRank, sortHandCards, type Card as CardType, type StandardSuit } from "@lie/shared";
import Card from "./Card";

const CARD_BASE_WIDTH = 49;
const CARD_BASE_HEIGHT = 65;
const HAND_CARD_MAX_SCALE = 2.35;
const HAND_CARD_MIN_SCALE = 0.78;
const HAND_GROUP_STEP = 9;
const HAND_STACK_STEP = 16;
const HAND_FAN_MAX_ROTATE = 14;
const HAND_FAN_MAX_LIFT = 12;
const HAND_VERTICAL_PADDING = 36;
const HAND_VIEWPORT_HEIGHT_RATIO = 0.34;
const HAND_VIEWPORT_MIN_HEIGHT = 132;
const HAND_VIEWPORT_MAX_HEIGHT = 286;
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

/**
 * @Description: 按牌点把手牌分成堆，并在每堆内按花色或大小王顺序稳定排序。
 *
 * @param cards 当前可展示的手牌。
 * @return 用于渲染堆叠扇形手牌的分组列表。
 *
 * @Date 2026-06-12 14:47
 */
export function groupHandCards(cards: CardType[]) {
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

function getHandMaxHeight(viewportHeight: number) {
  if (!viewportHeight) {
    return Infinity;
  }

  return Math.min(
    Math.max(viewportHeight * HAND_VIEWPORT_HEIGHT_RATIO, HAND_VIEWPORT_MIN_HEIGHT),
    HAND_VIEWPORT_MAX_HEIGHT,
  );
}

function getHandHeightBase(maxStackSize: number) {
  return CARD_BASE_HEIGHT + HAND_FAN_MAX_LIFT + HAND_STACK_STEP * Math.max(0, maxStackSize - 1);
}

function getHeightFittedScale(viewportHeight: number, maxStackSize: number) {
  const maxHeight = getHandMaxHeight(viewportHeight);

  if (!Number.isFinite(maxHeight)) {
    return HAND_CARD_MAX_SCALE;
  }

  return Math.max((maxHeight - HAND_VERTICAL_PADDING) / getHandHeightBase(maxStackSize), HAND_CARD_MIN_SCALE);
}

/**
 * @Description: 同时根据容器宽度和视口高度计算手牌缩放，避免手机横屏或小屏裁切。
 *
 * @param containerWidth 手牌容器宽度。
 * @param viewportHeight 当前可视高度。
 * @param groupCount 手牌分组数量。
 * @param maxStackSize 最大单组堆叠数量。
 * @return CSS 变量使用的牌面缩放值。
 *
 * @Date 2026-06-12 14:47
 */
function getHandScale(containerWidth: number, viewportHeight: number, groupCount: number, maxStackSize: number) {
  if (!containerWidth || groupCount < 1) {
    return 1;
  }

  const heightFittedScale = getHeightFittedScale(viewportHeight, maxStackSize);

  if (groupCount <= 2) {
    return Math.min(HAND_CARD_MAX_SCALE, heightFittedScale);
  }

  const availableWidth = Math.max(containerWidth - getHandEdgePadding(containerWidth) * 2, CARD_BASE_WIDTH);
  const handBaseWidth = CARD_BASE_WIDTH + HAND_GROUP_STEP * Math.max(0, groupCount - 1);
  const fittedScale = availableWidth / handBaseWidth;

  return Math.min(Math.max(fittedScale, HAND_CARD_MIN_SCALE), HAND_CARD_MAX_SCALE, heightFittedScale);
}

function getHandEdgePadding(containerWidth: number) {
  return Math.min(Math.max(containerWidth * 0.064, 18), 30);
}

function getHandHeight(scale: number, maxStackSize: number) {
  return getHandHeightBase(maxStackSize) * scale + HAND_VERTICAL_PADDING;
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

/**
 * @Description: 渲染本地玩家真实手牌，并支持按住拖过多张牌连续选中或取消。
 *
 * @param cards 当前真实可见手牌。
 * @param dealing 是否处于发牌动画中。
 * @param disabled 是否禁用交互。
 * @param dealTargetCards 发牌动画期间用于预占目标位置的完整手牌。
 * @param returnTargetCards 回收弃牌动画期间用于预占目标位置的完整手牌。
 * @param selectedCardIds 已选中的手牌 ID。
 * @param onToggleCard 键盘或单击切换选中回调。
 * @param onSetCardSelected 拖选时按目标状态设置选中回调。
 * @return 手牌区域组件。
 *
 * @Date 2026-06-12 14:47
 */
export default function Hand({
  cards,
  dealing = false,
  disabled = false,
  dealTargetCards,
  returnTargetCards,
  selectedCardIds,
  onToggleCard,
  onSetCardSelected,
}: {
  cards: CardType[];
  dealing?: boolean;
  disabled?: boolean;
  dealTargetCards?: CardType[];
  returnTargetCards?: CardType[];
  selectedCardIds: string[];
  onToggleCard: (cardId: string) => void;
  onSetCardSelected: (cardId: string, selected: boolean) => void;
}) {
  const handRef = useRef<HTMLDivElement>(null);
  const dragSelectionRef = useRef<DragSelectionState | null>(null);
  const [handWidth, setHandWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const visibleCardIds = new Set(cards.map((card) => card.id));
  const displayCards = dealTargetCards?.length ? dealTargetCards : returnTargetCards?.length ? returnTargetCards : cards;
  const dealTargetIndexByCardId = new Map((dealTargetCards ?? []).map((card, index) => [card.id, index]));
  const handGroups = groupHandCards(displayCards);
  const returnTargetIndexByCardId = new Map(
    handGroups
      .flatMap((group) => group.cards)
      .filter((card) => Boolean(returnTargetCards?.length) && !visibleCardIds.has(card.id))
      .map((card, index) => [card.id, index]),
  );
  const maxStackSize = handGroups.reduce((maxSize, group) => Math.max(maxSize, group.cards.length), 1);
  const handScale = getHandScale(handWidth, viewportHeight, handGroups.length, maxStackSize);
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

  useEffect(() => {
    const updateViewportHeight = () => {
      const nextHeight = window.visualViewport?.height ?? window.innerHeight;

      setViewportHeight((currentHeight) => (Math.abs(currentHeight - nextHeight) > 1 ? nextHeight : currentHeight));
    };

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    window.visualViewport?.addEventListener("resize", updateViewportHeight);

    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      window.visualViewport?.removeEventListener("resize", updateViewportHeight);
    };
  }, []);

  function applyDraggedCard(cardId: string, dragSelection: DragSelectionState) {
    if (dragSelection.visitedCardIds.has(cardId)) {
      return;
    }

    dragSelection.visitedCardIds.add(cardId);
    onSetCardSelected(cardId, dragSelection.selecting);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled) {
      return;
    }

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
      {displayCards.length ? (
        <>
          <div
            ref={handRef}
            className="lie-game-hand"
            aria-label="你的手牌"
            aria-disabled={disabled}
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
                  <Fragment key={card.id}>
                    {dealTargetCards?.length ? (
                      <span
                        data-deal-target={`self:${dealTargetIndexByCardId.get(card.id) ?? stackIndex}`}
                        className="lie-game-hand-card lie-game-hand-card-target"
                        style={
                          {
                            "--hand-card-x": `${groupX + stackOffset.x}px`,
                            "--hand-card-y": `${-upwardOffset}px`,
                            "--hand-card-rotate": `${rotate}deg`,
                            zIndex: groupIndex * (maxStackSize + 1) + (maxStackSize - stackIndex),
                          } as CSSProperties
                        }
                      />
                    ) : null}
                    {typeof returnTargetIndexByCardId.get(card.id) === "number" ? (
                      <span
                        data-return-target={`self:${returnTargetIndexByCardId.get(card.id)}`}
                        className="lie-game-hand-card lie-game-hand-card-target"
                        style={
                          {
                            "--hand-card-x": `${groupX + stackOffset.x}px`,
                            "--hand-card-y": `${-upwardOffset}px`,
                            "--hand-card-rotate": `${rotate}deg`,
                            zIndex: groupIndex * (maxStackSize + 1) + (maxStackSize - stackIndex),
                          } as CSSProperties
                        }
                      />
                    ) : null}
                    {visibleCardIds.has(card.id) ? (
                      <Card
                        card={card}
                        dealing={dealing}
                        disabled={disabled}
                        selected={selectedCardIds.includes(card.id)}
                        onKeyboardToggle={disabled ? undefined : () => onToggleCard(card.id)}
                        style={
                          {
                            "--hand-card-x": `${groupX + stackOffset.x}px`,
                            "--hand-card-y": `${-upwardOffset}px`,
                            "--hand-card-rotate": `${rotate}deg`,
                            zIndex: groupIndex * (maxStackSize + 1) + (maxStackSize - stackIndex),
                          } as CSSProperties
                        }
                      />
                    ) : null}
                  </Fragment>
                );
              });
            })}
          </div>
          {/* <div className="text-center text-xs font-black tracking-[0.16em] text-[#f2df9e]">
            {cards.length}/{cards.length}
          </div> */}
        </>
      ) : (
        <div className="grid min-h-28 place-items-center text-sm text-[#c6b889]">没有手牌</div>
      )}
    </div>
  );
}
