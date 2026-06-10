/**
 * 共享牌面工具：创建包含大小王的 54 张牌、按种子洗牌、按玩家发牌。
 */
import { DECLARABLE_RANKS, JOKER_RANKS, JOKER_SUIT, RANKS, SUITS } from "./constants";

export type StandardSuit = (typeof SUITS)[number];
export type Suit = StandardSuit | typeof JOKER_SUIT;
export type DeclaredRank = (typeof DECLARABLE_RANKS)[number];
export type JokerRank = (typeof JOKER_RANKS)[number];
export type Rank = (typeof RANKS)[number];

export type Card = {
  id: string;
  rank: Rank;
  suit: Suit;
};

export function createDeck(): Card[] {
  const standardCards = DECLARABLE_RANKS.flatMap((rank) =>
    SUITS.map((suit) => ({
      id: `${rank}${suit}`,
      rank,
      suit,
    })),
  );

  return [
    ...standardCards,
    {
      id: "BJ",
      rank: "BLACK_JOKER",
      suit: JOKER_SUIT,
    },
    {
      id: "RJ",
      rank: "RED_JOKER",
      suit: JOKER_SUIT,
    },
  ];
}

function hashSeed(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function seededRandom(seed: string) {
  const nextHash = hashSeed(seed);
  let value = nextHash();
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleDeck(deck: Card[], seed = cryptoRandomSeed()): Card[] {
  // 使用确定性随机数，方便后续按 deckSeed 复盘或审计对局。
  const random = seededRandom(seed);
  const shuffled = [...deck];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

export function dealCards(deck: Card[], playerIds: string[]): Record<string, Card[]> {
  const hands: Record<string, Card[]> = Object.fromEntries(playerIds.map((playerId) => [playerId, []]));

  deck.forEach((card, index) => {
    const playerId = playerIds[index % playerIds.length];
    hands[playerId].push(card);
  });

  return hands;
}

export function isCardId(value: string) {
  return createDeck().some((card) => card.id === value);
}

export function isJokerRank(rank: Rank): rank is JokerRank {
  return rank === "BLACK_JOKER" || rank === "RED_JOKER";
}

export function isJokerCard(card: Card) {
  return isJokerRank(card.rank);
}

function cryptoRandomSeed() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
