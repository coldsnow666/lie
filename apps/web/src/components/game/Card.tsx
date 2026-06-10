/**
 * 手牌卡牌组件：展示单张牌并支持选中状态。
 */
import type { CSSProperties } from "react";
import type { Card as CardType } from "@lie/shared";
import { getCardLabel } from "@/lib/card-assets";
import DomPlayingCard from "./DomPlayingCard";

export default function Card({
  card,
  selected = false,
  onClick,
  style,
}: {
  card: CardType;
  selected?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  const label = getCardLabel(card);

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${selected ? "取消选择" : "选择"}${label}`}
      onClick={onClick}
      data-selected={selected ? "true" : undefined}
      style={style}
      className="lie-game-hand-card group grid h-auto shrink-0 place-items-center bg-transparent transition"
    >
      <DomPlayingCard
        card={card}
        className={`${
          selected
            ? "drop-shadow-[0_0_0_#d7bc72] shadow-[0_0_0_3px_rgba(215,188,114,0.35)]"
            : "group-hover:drop-shadow-[0_0_6px_rgba(242,223,158,0.58)]"
        }`}
      />
    </button>
  );
}
