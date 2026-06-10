/**
 * 手牌卡牌组件：展示单张牌并支持选中状态。
 */
import type { Card as CardType } from "@lie/shared";
import { getCardLabel } from "@/lib/card-assets";
import DomPlayingCard from "./DomPlayingCard";

export default function Card({
  card,
  selected = false,
  onClick,
}: {
  card: CardType;
  selected?: boolean;
  onClick?: () => void;
}) {
  const label = getCardLabel(card);

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${selected ? "取消选择" : "选择"}${label}`}
      onClick={onClick}
      className={`group grid h-auto shrink-0 place-items-center bg-transparent transition ${
        selected ? "-translate-y-3 drop-shadow-[0_14px_0_rgba(215,188,114,0.26)]" : "hover:-translate-y-1"
      }`}
    >
      <DomPlayingCard
        card={card}
        className={`[--pixel-card-scale:1.9] sm:[--pixel-card-scale:2.25] ${
          selected
            ? "drop-shadow-[0_0_0_#d7bc72] shadow-[0_0_0_3px_rgba(215,188,114,0.35)]"
            : "group-hover:drop-shadow-[0_0_6px_rgba(242,223,158,0.58)]"
        }`}
      />
    </button>
  );
}
