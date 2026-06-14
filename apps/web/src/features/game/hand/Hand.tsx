/**
 * @Description: 手牌区域组件：以无面板的堆叠牌列展示本地玩家可见的真实手牌。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import { Fragment, type CSSProperties, type PointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { Card as CardType } from "@lie/shared";
import Card from "./Card";
import {
  getFanLift,
  getFanRotate,
  getHandEdgePadding,
  getHandHeight,
  getHandScale,
  getStackOffset,
  groupHandCards,
  groupReturnTargetCards,
  HAND_GROUP_STEP,
} from "./handLayout";

export { groupHandCards } from "./handLayout";

type DragSelectionState = {
  pointerId: number;
  selecting: boolean;
  visitedCardIds: Set<string>;
};

function getCardIdFromTarget(target: EventTarget | Element | null) {
  return target instanceof Element ? (target.closest<HTMLElement>("[data-hand-card-id]")?.dataset.handCardId ?? null) : null;
}

/**
 * @Description: 渲染本地玩家真实手牌，并支持按住拖过多张牌连续选中或取消。
 *
 * @param cards 当前真实可见手牌。
 * @param dealing 是否处于发牌动画中。
 * @param disabled 是否禁用交互。
 * @param dealTargetCards 发牌动画期间用于预占目标位置的完整手牌。
 * @param hiddenCardIds 需要保留位置但临时隐藏的手牌 ID。
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
  hiddenCardIds = [],
  returnTargetCards,
  selectedCardIds,
  onToggleCard,
  onSetCardSelected,
}: {
  cards: CardType[];
  dealing?: boolean;
  disabled?: boolean;
  dealTargetCards?: CardType[];
  hiddenCardIds?: string[];
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
  const hiddenCardIdSet = new Set(hiddenCardIds);
  const displayCards = dealTargetCards?.length ? dealTargetCards : returnTargetCards?.length ? returnTargetCards : cards;
  const dealTargetIndexByCardId = new Map((dealTargetCards ?? []).map((card, index) => [card.id, index]));
  const showingReturnTargets = Boolean(returnTargetCards?.length) && !dealTargetCards?.length;
  const handGroups = showingReturnTargets ? groupReturnTargetCards(displayCards, visibleCardIds) : groupHandCards(displayCards);
  const returnTargetIndexByCardId = new Map(
    handGroups
      .flatMap((group) => group.cards)
      .filter((card) => showingReturnTargets && !visibleCardIds.has(card.id))
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
                            opacity: hiddenCardIdSet.has(card.id) ? 0 : undefined,
                            pointerEvents: hiddenCardIdSet.has(card.id) ? "none" : undefined,
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
