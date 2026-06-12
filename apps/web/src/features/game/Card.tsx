/**
 * @Description: 手牌卡牌组件：展示单张牌并支持选中状态。
 *
 * @Date 2026-06-12 14:47
 */
import type { CSSProperties } from "react";
import type { Card as CardType } from "@lie/shared";
import { getCardLabel } from "@/lib/card-assets";
import DomPlayingCard from "@/components/cards/DomPlayingCard";

export default function Card({
  card,
  selected = false,
  dealing = false,
  dealTarget = false,
  returnTargetIndex,
  disabled = false,
  onKeyboardToggle,
  style,
}: {
  card: CardType;
  selected?: boolean;
  dealing?: boolean;
  dealTarget?: boolean;
  returnTargetIndex?: number;
  disabled?: boolean;
  onKeyboardToggle?: () => void;
  style?: CSSProperties;
}) {
  const label = getCardLabel(card);

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${selected ? "取消选择" : "选择"}${label}`}
      disabled={disabled}
      onClick={(event) => {
        if (!disabled && event.detail === 0) {
          onKeyboardToggle?.();
        }
      }}
      data-hand-card-id={card.id}
      data-dealing={dealing ? "true" : undefined}
      data-deal-target={dealTarget ? "self" : undefined}
      data-return-target={typeof returnTargetIndex === "number" ? `self:${returnTargetIndex}` : undefined}
      data-selected={selected ? "true" : undefined}
      style={style}
      className="lie-game-hand-card grid h-auto shrink-0 place-items-center bg-transparent transition"
    >
      <DomPlayingCard card={card} />
    </button>
  );
}
