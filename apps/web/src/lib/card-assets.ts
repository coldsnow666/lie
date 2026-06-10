/**
 * 文件说明：集中维护扑克牌牌面显示文案。
 */
import { JOKER_SUIT, type Card, type Rank, type Suit } from "@lie/shared";

export const SUIT_LABELS: Record<Suit, string> = {
  S: "黑桃",
  H: "红桃",
  D: "方块",
  C: "梅花",
  [JOKER_SUIT]: "王",
};

export const RANK_LABELS: Record<Rank, string> = {
  A: "A",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  "10": "10",
  J: "J",
  Q: "Q",
  K: "K",
  BLACK_JOKER: "小王",
  RED_JOKER: "大王",
};

export function getCardLabel(card: Pick<Card, "rank" | "suit">) {
  if (card.rank === "BLACK_JOKER" || card.rank === "RED_JOKER") {
    return RANK_LABELS[card.rank];
  }

  return `${SUIT_LABELS[card.suit]} ${RANK_LABELS[card.rank]}`;
}
