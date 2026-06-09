/**
 * 共享游戏规则引擎：只包含纯函数，不依赖 Socket、Redis 或数据库。
 */
import { MAX_PLAY_CARDS, MAX_PLAYERS, MIN_PLAY_CARDS, MIN_PLAYERS, RANKS } from "./constants";
import { createDeck, dealCards, shuffleDeck, type Card, type Rank } from "./cards";
import type { CardsPlayedEvent, ChallengeResolvedEvent } from "./events";

export type Player = {
  playerId: string;
  userId: string;
  nickname: string;
  seatIndex: number;
  socketId?: string | null;
  connected: boolean;
  ready: boolean;
};

export type DiscardEntry = {
  card: Card;
  playedByPlayerId: string;
  turnSeq: number;
};

export type LastPlay = {
  playerId: string;
  declaredRank: Rank;
  declaredCount: number;
  actualCards: Card[];
  turnSeq: number;
};

export type PrivateGameState = {
  matchId: string;
  roomId: string;
  status: "waiting" | "playing" | "finished";
  players: Player[];
  hands: Record<string, Card[]>;
  discardPile: DiscardEntry[];
  currentPlayerId: string;
  currentRank: Rank;
  lastPlay: LastPlay | null;
  turnSeq: number;
  winnerPlayerId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type PublicGameState = Omit<PrivateGameState, "hands" | "discardPile" | "lastPlay"> & {
  players: Array<Player & { cardCount: number }>;
  selfHand: Card[];
  discardPileCount: number;
  lastPlay: Omit<LastPlay, "actualCards"> | null;
};

export type PlayCardsResult = {
  state: PrivateGameState;
  event: CardsPlayedEvent;
};

export type ChallengeResult = {
  state: PrivateGameState;
  event: ChallengeResolvedEvent;
};

export function assertPlayerCount(players: Player[]) {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new Error(`PLAYERS_MUST_BE_${MIN_PLAYERS}_TO_${MAX_PLAYERS}`);
  }
}

export function getNextRank(rank: Rank): Rank {
  const index = RANKS.indexOf(rank);
  return RANKS[(index + 1) % RANKS.length];
}

export function getNextPlayer(players: Player[], currentPlayerId: string): Player {
  const sorted = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  const index = sorted.findIndex((player) => player.playerId === currentPlayerId);

  if (index === -1) {
    throw new Error("CURRENT_PLAYER_NOT_FOUND");
  }

  return sorted[(index + 1) % sorted.length];
}

export function createInitialGameState(params: {
  matchId: string;
  roomId: string;
  players: Player[];
  seed: string;
  now?: number;
}): PrivateGameState {
  assertPlayerCount(params.players);

  // 座位顺序决定首位玩家和顺时针行动顺序，不能依赖数组传入顺序。
  const players = [...params.players]
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((player) => ({ ...player, ready: true, connected: player.connected ?? true }));
  const deck = shuffleDeck(createDeck(), params.seed);
  const hands = dealCards(deck, players.map((player) => player.playerId));
  const now = params.now ?? Date.now();

  return {
    matchId: params.matchId,
    roomId: params.roomId,
    status: "playing",
    players,
    hands,
    discardPile: [],
    currentPlayerId: players[0].playerId,
    currentRank: "A",
    lastPlay: null,
    turnSeq: 1,
    winnerPlayerId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function playCards(state: PrivateGameState, actorPlayerId: string, cardIds: string[]): PlayCardsResult {
  if (state.status !== "playing") {
    throw new Error("GAME_NOT_PLAYING");
  }

  if (state.currentPlayerId !== actorPlayerId) {
    throw new Error("NOT_YOUR_TURN");
  }

  if (cardIds.length < MIN_PLAY_CARDS || cardIds.length > MAX_PLAY_CARDS) {
    throw new Error("INVALID_CARD_COUNT");
  }

  if (new Set(cardIds).size !== cardIds.length) {
    throw new Error("DUPLICATE_CARD_IDS");
  }

  const hand = state.hands[actorPlayerId] ?? [];
  const selectedCards = cardIds.map((cardId) => {
    const card = hand.find((candidate) => candidate.id === cardId);
    if (!card) {
      throw new Error("CARD_NOT_IN_HAND");
    }
    return card;
  });

  const selectedSet = new Set(cardIds);
  const nextHand = hand.filter((card) => !selectedSet.has(card.id));
  const turnSeq = state.turnSeq + 1;
  const nextPlayer = getNextPlayer(state.players, actorPlayerId);
  // 声明牌点由服务端当前状态决定，客户端只提交真实想打出的 cardIds。
  const status = nextHand.length === 0 ? "finished" : "playing";
  const winnerPlayerId = nextHand.length === 0 ? actorPlayerId : null;

  const nextState: PrivateGameState = {
    ...state,
    status,
    hands: {
      ...state.hands,
      [actorPlayerId]: nextHand,
    },
    discardPile: [
      ...state.discardPile,
      ...selectedCards.map((card) => ({
        card,
        playedByPlayerId: actorPlayerId,
        turnSeq,
      })),
    ],
    currentPlayerId: nextPlayer.playerId,
    currentRank: getNextRank(state.currentRank),
    lastPlay: {
      playerId: actorPlayerId,
      declaredRank: state.currentRank,
      declaredCount: selectedCards.length,
      actualCards: selectedCards,
      turnSeq,
    },
    turnSeq,
    winnerPlayerId,
    updatedAt: Date.now(),
  };

  return {
    state: nextState,
    event: {
      type: "cards_played",
      actorPlayerId,
      declaredRank: state.currentRank,
      declaredCount: selectedCards.length,
      turnSeq,
    },
  };
}

export function challengeLastPlay(state: PrivateGameState, challengerPlayerId: string): ChallengeResult {
  if (state.status !== "playing") {
    throw new Error("GAME_NOT_PLAYING");
  }

  if (!state.lastPlay) {
    throw new Error("NO_LAST_PLAY");
  }

  if (state.lastPlay.playerId === challengerPlayerId) {
    throw new Error("CANNOT_CHALLENGE_SELF");
  }

  if (!state.players.some((player) => player.playerId === challengerPlayerId)) {
    throw new Error("PLAYER_NOT_IN_GAME");
  }

  const wasTruthful = state.lastPlay.actualCards.every((card) => card.rank === state.lastPlay?.declaredRank);
  // MVP 规则：质疑失败者拿走整个弃牌堆，并由拿走牌堆的人继续行动。
  const pileTakenByPlayerId = wasTruthful ? challengerPlayerId : state.lastPlay.playerId;
  const turnSeq = state.turnSeq + 1;
  const pileCards = state.discardPile.map((entry) => entry.card);

  const nextState: PrivateGameState = {
    ...state,
    hands: {
      ...state.hands,
      [pileTakenByPlayerId]: [...(state.hands[pileTakenByPlayerId] ?? []), ...pileCards],
    },
    discardPile: [],
    currentPlayerId: pileTakenByPlayerId,
    lastPlay: null,
    turnSeq,
    updatedAt: Date.now(),
  };

  return {
    state: nextState,
    event: {
      type: "challenge_resolved",
      challengerPlayerId,
      challengedPlayerId: state.lastPlay.playerId,
      wasTruthful,
      revealedCards: state.lastPlay.actualCards,
      pileTakenByPlayerId,
      turnSeq,
    },
  };
}

export function toPublicGameState(state: PrivateGameState, viewerPlayerId: string): PublicGameState {
  // 每个玩家只能看到自己的手牌；其他玩家只暴露剩余牌数，避免泄露隐藏信息。


  const players = state.players.map((player) => ({
    ...player,
    cardCount: state.hands[player.playerId]?.length ?? 0,
  }))

  const lastPlay = state.lastPlay
    ? {
      playerId: state.lastPlay.playerId,
      declaredRank: state.lastPlay.declaredRank,
      declaredCount: state.lastPlay.declaredCount,
      turnSeq: state.lastPlay.turnSeq,
    }
    : null


  return {
    matchId: state.matchId,
    roomId: state.roomId,
    status: state.status,
    players,
    selfHand: state.hands[viewerPlayerId] ?? [],
    discardPileCount: state.discardPile.length,
    currentPlayerId: state.currentPlayerId,
    currentRank: state.currentRank,
    lastPlay,
    turnSeq: state.turnSeq,
    winnerPlayerId: state.winnerPlayerId,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  };
}
