/**
 * 手牌卡牌组件：展示单张牌并支持选中状态。
 */
import type { Card as CardType } from "@lie/shared";

const SUIT_SYMBOLS: Record<CardType["suit"], string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
};

export default function Card({
  card,
  selected = false,
  onClick,
}: {
  card: CardType;
  selected?: boolean;
  onClick?: () => void;
}) {
  const red = card.suit === "H" || card.suit === "D";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid h-28 w-20 shrink-0 place-items-center rounded border-2 bg-[#f7f0dc] font-bold shadow-lg transition ${
        selected ? "-translate-y-3 border-[#d7bc72] shadow-[#d7bc72]/40" : "border-[#efe3bd] hover:-translate-y-1"
      }`}
    >
      <span className={red ? "text-[#b33332]" : "text-[#17251f]"}>
        <span className="block text-3xl">{card.rank}</span>
        <span className="block text-2xl">{SUIT_SYMBOLS[card.suit]}</span>
      </span>
    </button>
  );
}
