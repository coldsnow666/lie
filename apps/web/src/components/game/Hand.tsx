/**
 * 手牌区域组件：横向展示本地玩家可见的真实手牌。
 */
import type { Card as CardType } from "@lie/shared";
import Card from "./Card";

export default function Hand({
  cards,
  selectedCardIds,
  onToggleCard,
}: {
  cards: CardType[];
  selectedCardIds: string[];
  onToggleCard: (cardId: string) => void;
}) {
  return (
    <div className="flex min-h-36 gap-2 overflow-x-auto rounded border border-white/10 bg-black/20 p-4">
      {cards.length ? (
        cards.map((card) => (
          <Card key={card.id} card={card} selected={selectedCardIds.includes(card.id)} onClick={() => onToggleCard(card.id)} />
        ))
      ) : (
        <div className="grid flex-1 place-items-center text-sm text-[#c6b889]">没有手牌</div>
      )}
    </div>
  );
}
