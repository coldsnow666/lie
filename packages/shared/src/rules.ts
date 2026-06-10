/**
 * 共享游戏规则引擎：只包含纯函数，不依赖 Socket、Redis 或数据库。
 */
import { MAX_PLAY_CARDS, MAX_PLAYERS, MIN_PLAY_CARDS, MIN_PLAYERS } from "./constants";
import { createGameDeck, dealFixedHands, getGameDeckConfig, isJokerCard, shuffleDeck, sortHandCards, type Card, type DeclaredRank } from "./cards";
import type { CardsPlayedEvent, ChallengeResolvedEvent } from "./events";

export type Player = {
  playerId: string;
  userId: string;
  nickname: string;
  seatIndex: number;
  socketId?: string | null;
  connected: boolean;
  ready: boolean;
  pendingWin: boolean;
};

export type DiscardEntry = {
  card: Card;
  playedByPlayerId: string;
  turnSeq: number;
};

export type LastPlay = {
  playerId: string;
  declaredRank: DeclaredRank;
  cardCount: number;
  actualCards: Card[];
  timestamp: number;
};

export type PrivateGameState = {
  matchId: string;
  roomId: string;
  status: "waiting" | "playing" | "finished";
  players: Player[];
  hands: Record<string, Card[]>;
  undealtCards: Card[];
  discardPile: DiscardEntry[];
  currentPlayerId: string;
  lastPlay: LastPlay | null;
  turnSeq: number;
  winnerPlayerId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type PublicGameState = Omit<PrivateGameState, "hands" | "undealtCards" | "discardPile" | "lastPlay"> & {
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

function updatePlayerPendingWin(players: Player[], pendingPlayerId: string | null) {
  return players.map((player) => ({
    ...player,
    pendingWin: pendingPlayerId ? player.playerId === pendingPlayerId : false,
  }));
}

export function assertPlayerCount(players: Player[]) {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new Error(`PLAYERS_MUST_BE_${MIN_PLAYERS}_TO_${MAX_PLAYERS}`);
  }
}

export function getNextPlayer(players: Player[], currentPlayerId: string): Player {
  const sorted = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  const index = sorted.findIndex((player) => player.playerId === currentPlayerId);

  if (index === -1) {
    throw new Error("CURRENT_PLAYER_NOT_FOUND");
  }

  return sorted[(index + 1) % sorted.length];
}

export function isTruthfulPlay(actualCards: Card[], declaredRank: DeclaredRank) {
  return actualCards.every((card) => card.rank === declaredRank || isJokerCard(card));
}

export function findPendingWinner(state: PrivateGameState) {
  return state.players.find((player) => player.pendingWin) ?? null;
}

export function finalizePendingWinner(state: PrivateGameState): PrivateGameState {
  const pendingWinner = findPendingWinner(state);

  if (!pendingWinner) {
    throw new Error("PENDING_WIN_NOT_FOUND");
  }

  return {
    ...state,
    status: "finished",
    players: updatePlayerPendingWin(state.players, null),
    winnerPlayerId: pendingWinner.playerId,
    updatedAt: Date.now(),
  };
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
  const deckConfig = getGameDeckConfig(players.length);
  const deck = shuffleDeck(createGameDeck(players.length, params.seed), `${params.seed}:shuffle`);
  const { hands, undealtCards } = dealFixedHands(deck, players.map((player) => player.playerId), deckConfig.handSize);
  const now = params.now ?? Date.now();

  return {
    matchId: params.matchId,
    roomId: params.roomId,
    status: "playing",
    players,
    hands,
    undealtCards,
    discardPile: [],
    currentPlayerId: players[0].playerId,
    lastPlay: null,
    turnSeq: 1,
    winnerPlayerId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function playCards(
  state: PrivateGameState,
  actorPlayerId: string,
  cardIds: string[],
  declaredRank: DeclaredRank,
): PlayCardsResult {
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
  const pendingPlayerId = nextHand.length === 0 ? actorPlayerId : null;

  const nextState: PrivateGameState = {
    ...state,
    status: "playing",
    players: updatePlayerPendingWin(state.players, pendingPlayerId),
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
    lastPlay: {
      playerId: actorPlayerId,
      declaredRank,
      cardCount: selectedCards.length,
      actualCards: selectedCards,
      timestamp: Date.now(),
    },
    turnSeq,
    winnerPlayerId: null,
    updatedAt: Date.now(),
  };

  return {
    state: nextState,
    event: {
      type: "cards_played",
      actorPlayerId,
      declaredRank,
      cardCount: selectedCards.length,
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

  const challengedPlayerId = state.lastPlay.playerId;
  const challengedPlayerWasPendingWinner = state.players.some(
    (player) => player.playerId === challengedPlayerId && player.pendingWin,
  );
  const wasTruthful = isTruthfulPlay(state.lastPlay.actualCards, state.lastPlay.declaredRank);
  // MVP 规则：质疑失败者拿走整个弃牌堆，并由拿走牌堆的人继续行动。
  const pileTakenByPlayerId = wasTruthful ? challengerPlayerId : challengedPlayerId;
  const turnSeq = state.turnSeq + 1;
  const pileCards = state.discardPile.map((entry) => entry.card);
  const challengedPlayerWins = wasTruthful && challengedPlayerWasPendingWinner;

  const nextState: PrivateGameState = {
    ...state,
    status: challengedPlayerWins ? "finished" : "playing",
    players: updatePlayerPendingWin(state.players, null),
    hands: {
      ...state.hands,
      [pileTakenByPlayerId]: [...(state.hands[pileTakenByPlayerId] ?? []), ...pileCards],
    },
    discardPile: [],
    currentPlayerId: pileTakenByPlayerId,
    lastPlay: null,
    turnSeq,
    winnerPlayerId: challengedPlayerWins ? challengedPlayerId : null,
    updatedAt: Date.now(),
  };

  return {
    state: nextState,
    event: {
      type: "challenge_resolved",
      challengerPlayerId,
      challengedPlayerId,
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
      cardCount: state.lastPlay.cardCount,
      timestamp: state.lastPlay.timestamp,
    }
    : null


  return {
    matchId: state.matchId,
    roomId: state.roomId,
    status: state.status,
    players,
    selfHand: sortHandCards(state.hands[viewerPlayerId] ?? []),
    discardPileCount: state.discardPile.length,
    currentPlayerId: state.currentPlayerId,
    lastPlay,
    turnSeq: state.turnSeq,
    winnerPlayerId: state.winnerPlayerId,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  };
}
