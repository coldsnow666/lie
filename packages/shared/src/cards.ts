/**
 * @Description: 共享牌面工具：创建完整展示牌堆，并按局内玩家数生成服务端权威牌库。
 *
 * @Date 2026-06-12 14:47
 */
import { DECLARABLE_RANKS, JOKER_RANKS, JOKER_SUIT, RANKS, SUITS } from "./constants";

export type StandardSuit = (typeof SUITS)[number];
export type Suit = StandardSuit | typeof JOKER_SUIT;
export type DeclaredRank = (typeof DECLARABLE_RANKS)[number];
export type JokerRank = (typeof JOKER_RANKS)[number];
export type Rank = (typeof RANKS)[number];
export type SupportedDeckPlayerCount = 2 | 3;

export type Card = {
  id: string;
  rank: Rank;
  suit: Suit;
};

export const GAME_DECK_CONFIG: Record<SupportedDeckPlayerCount, { deckSize: number; handSize: number; rankCount: number }> = {
  2: {
    deckSize: 22,
    handSize: 11,
    rankCount: 5,
  },
  3: {
    deckSize: 34,
    handSize: 11,
    rankCount: 8,
  },
};

const HAND_RANK_ORDER: Rank[] = [
  "RED_JOKER",
  "BLACK_JOKER",
  "K",
  "Q",
  "J",
  "10",
  "9",
  "8",
  "7",
  "6",
  "5",
  "4",
  "3",
  "2",
  "A",
];

const rankSortWeight = new Map<Rank, number>(HAND_RANK_ORDER.map((rank, index) => [rank, index]));
const suitSortWeight = new Map<Suit, number>([...SUITS, JOKER_SUIT].map((suit, index) => [suit, index]));

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

function createStandardCardsByRanks(ranks: DeclaredRank[]) {
  return ranks.flatMap((rank) =>
    SUITS.map((suit) => ({
      id: `${rank}${suit}`,
      rank,
      suit,
    })),
  );
}

function createJokers(): Card[] {
  return [
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

function shuffleItems<T>(items: T[], seed: string): T[] {
  const random = seededRandom(seed);
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

export function getGameDeckConfig(playerCount: number) {
  if (playerCount !== 2 && playerCount !== 3) {
    throw new Error("UNSUPPORTED_PLAYER_COUNT");
  }

  return GAME_DECK_CONFIG[playerCount];
}

export function createGameDeck(playerCount: number, seed = cryptoRandomSeed()): Card[] {
  const config = getGameDeckConfig(playerCount);
  // 每局只随机抽取一部分点数，并保留被抽中点数的四种花色；大小王始终加入本局牌库。
  const selectedRanks = shuffleItems([...DECLARABLE_RANKS], `${seed}:ranks`).slice(0, config.rankCount);
  const deck = [...createStandardCardsByRanks(selectedRanks), ...createJokers()];

  if (deck.length !== config.deckSize) {
    throw new Error("GAME_DECK_SIZE_MISMATCH");
  }

  return deck;
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

export function dealFixedHands(deck: Card[], playerIds: string[], handSize: number) {
  const hands: Record<string, Card[]> = Object.fromEntries(playerIds.map((playerId) => [playerId, []]));
  const dealCount = playerIds.length * handSize;
  const dealtCards = deck.slice(0, dealCount);

  dealtCards.forEach((card, index) => {
    const playerId = playerIds[index % playerIds.length];
    hands[playerId].push(card);
  });

  return {
    hands,
    undealtCards: deck.slice(dealCount),
  };
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

export function sortHandCards(cards: Card[]) {
  return [...cards].sort((left, right) => {
    const rankDiff = (rankSortWeight.get(left.rank) ?? HAND_RANK_ORDER.length) - (rankSortWeight.get(right.rank) ?? HAND_RANK_ORDER.length);

    if (rankDiff !== 0) {
      return rankDiff;
    }

    return (suitSortWeight.get(left.suit) ?? SUITS.length) - (suitSortWeight.get(right.suit) ?? SUITS.length);
  });
}

function cryptoRandomSeed() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
