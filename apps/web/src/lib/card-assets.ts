/**
 * 文件说明：集中维护像素扑克牌雪碧图素材路径、裁切参数和牌面显示文案。
 */
import type { Card, Rank, Suit } from "@lie/shared";

export const PIXEL_CARD_ASSET_CREDIT = {
  name: "Pixel Poker Cards",
  author: "IvoryRed",
  url: "https://opengameart.org/content/pixel-poker-cards",
  license: "CC-BY 4.0",
} as const;

export const PIXEL_CARD_SPRITE = {
  src: "/assets/cards/open-game-art-pixel-poker/cards.png",
  imageWidth: 944,
  imageHeight: 385,
  cardWidth: 49,
  cardHeight: 65,
  courtWidth: 21,
  courtHeight: 46,
  jokerArtWidth: 34,
  jokerArtHeight: 46,
  originX: 32,
  originY: 15,
  columnStep: 64,
  rowStep: 96,
  jokerX: 880,
  jokerBlackY: 111,
  jokerRedY: 15,
} as const;

export const PIXEL_CARD_BACK_SPRITE = {
  src: "/assets/cards/open-game-art-pixel-poker/decks.png",
  imageWidth: 288,
  imageHeight: 176,
  cardWidth: 48,
  cardHeight: 80,
  columns: [17, 81, 145, 209, 17, 81, 145, 209],
  rows: [16, 16, 16, 16, 96, 96, 96, 96],
} as const;

export const SUIT_LABELS: Record<Suit, string> = {
  S: "黑桃",
  H: "红桃",
  D: "方块",
  C: "梅花",
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
};

const rankColumnMap: Record<Rank, number> = {
  A: 0,
  "2": 1,
  "3": 2,
  "4": 3,
  "5": 4,
  "6": 5,
  "7": 6,
  "8": 7,
  "9": 8,
  "10": 9,
  J: 10,
  Q: 11,
  K: 12,
};

const suitRowMap: Record<Suit, number> = {
  H: 0,
  D: 1,
  S: 2,
  C: 3,
};

export function getPixelCardSpritePosition(card: Pick<Card, "rank" | "suit">) {
  return {
    x: PIXEL_CARD_SPRITE.originX + rankColumnMap[card.rank] * PIXEL_CARD_SPRITE.columnStep,
    y: PIXEL_CARD_SPRITE.originY + suitRowMap[card.suit] * PIXEL_CARD_SPRITE.rowStep,
  };
}

export function getPixelJokerSpritePosition(color: "black" | "red") {
  return {
    x: PIXEL_CARD_SPRITE.jokerX,
    y: color === "black" ? PIXEL_CARD_SPRITE.jokerBlackY : PIXEL_CARD_SPRITE.jokerRedY,
  };
}

export function getPixelCourtSpriteRect(card: Pick<Card, "rank" | "suit">) {
  const position = getPixelCardSpritePosition(card);

  return {
    x: position.x + 14,
    y: position.y + 10,
    width: PIXEL_CARD_SPRITE.courtWidth,
    height: PIXEL_CARD_SPRITE.courtHeight,
  };
}

export function getPixelJokerSpriteRect(color: "black" | "red") {
  const position = getPixelJokerSpritePosition(color);

  return {
    x: position.x + 7,
    y: position.y + 9,
    width: PIXEL_CARD_SPRITE.jokerArtWidth,
    height: PIXEL_CARD_SPRITE.jokerArtHeight,
  };
}

export function getPixelCardBackSpritePosition(back = 0) {
  const index = Math.max(0, Math.min(back, PIXEL_CARD_BACK_SPRITE.columns.length - 1));

  return {
    x: PIXEL_CARD_BACK_SPRITE.columns[index],
    y: PIXEL_CARD_BACK_SPRITE.rows[index],
  };
}

export function getCardLabel(card: Pick<Card, "rank" | "suit">) {
  return `${SUIT_LABELS[card.suit]} ${RANK_LABELS[card.rank]}`;
}
