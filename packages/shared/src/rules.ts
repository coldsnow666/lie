/**
 * @Description: 共享游戏规则引擎：只包含纯函数，不依赖 Socket、Redis 或数据库。
 *
 * @Date 2026-06-12 14:47
 */
import { MAX_PLAY_CARDS, MAX_PLAYERS, MIN_PLAY_CARDS, MIN_PLAYERS } from "./constants";
import { createGameDeck, dealFixedHands, getGameDeckConfig, isJokerCard, shuffleDeck, sortHandCards, type Card, type DeclaredRank } from "./cards";
import type { CardsPlayedEvent, ChallengeResolvedEvent, TurnSkippedEvent } from "./events";

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
  turnDeadlineAt: number | null;
  lastPlay: LastPlay | null;
  turnSeq: number;
  winnerPlayerId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type PublicGameState = Omit<PrivateGameState, "players" | "hands" | "undealtCards" | "discardPile" | "lastPlay"> & {
  players: Array<Player & { cardCount: number; cardBack: number }>;
  selfHand: Card[];
  discardPileCount: number;
  discardPileCards: Array<Pick<DiscardEntry, "playedByPlayerId" | "turnSeq"> & { cardBack: number }>;
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

export type SkipTurnResult = {
  state: PrivateGameState;
  event: TurnSkippedEvent;
};

export const TURN_DURATION_MS = 30_000;

export function createTurnDeadline(now = Date.now(), delayMs = 0) {
  return now + delayMs + TURN_DURATION_MS;
}

function updatePlayerPendingWin(players: Player[], pendingPlayerId: string | null) {
  return players.map((player) => ({
    ...player,
    pendingWin: pendingPlayerId ? player.playerId === pendingPlayerId : false,
  }));
}

/**
 * @Description: 校验开局玩家人数是否落在当前规则允许范围内。
 *
 * @param players 当前房间座位快照。
 * @return 校验通过时不返回值，失败时抛出规则错误。
 *
 * @Date 2026-06-12 14:47
 */
export function assertPlayerCount(players: Player[]) {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new Error(`PLAYERS_MUST_BE_${MIN_PLAYERS}_TO_${MAX_PLAYERS}`);
  }
}

/**
 * @Description: 按座位顺序计算下一位行动玩家，保证服务端权威回合不受数组顺序影响。
 *
 * @param players 当前对局玩家列表。
 * @param currentPlayerId 当前行动玩家 ID。
 * @return 下一位行动玩家。
 *
 * @Date 2026-06-12 14:47
 */
export function getNextPlayer(players: Player[], currentPlayerId: string): Player {
  const sorted = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  const index = sorted.findIndex((player) => player.playerId === currentPlayerId);

  if (index === -1) {
    throw new Error("CURRENT_PLAYER_NOT_FOUND");
  }

  return sorted[(index + 1) % sorted.length];
}

/**
 * @Description: 判定上一手是否如实声明，大小王在本规则中视为万能真牌。
 *
 * @param actualCards 上一手真实打出的牌。
 * @param declaredRank 上一手声明的牌点。
 * @return 全部牌满足声明时返回 true。
 *
 * @Date 2026-06-12 14:47
 */
export function isTruthfulPlay(actualCards: Card[], declaredRank: DeclaredRank) {
  return actualCards.every((card) => card.rank === declaredRank || isJokerCard(card));
}

function resolveDeclaredRank(state: PrivateGameState, declaredRank?: DeclaredRank) {
  // 弃牌堆未被质疑结算前，首个声明牌点会锁定整轮跟牌目标。
  const lockedDeclaredRank = state.lastPlay?.declaredRank ?? null;

  if (!lockedDeclaredRank) {
    if (!declaredRank) {
      throw new Error("DECLARED_RANK_REQUIRED");
    }

    return declaredRank;
  }

  if (declaredRank && declaredRank !== lockedDeclaredRank) {
    throw new Error("DECLARED_RANK_LOCKED");
  }

  return lockedDeclaredRank;
}

export function findPendingWinner(state: PrivateGameState) {
  return state.players.find((player) => player.pendingWin) ?? null;
}

/**
 * @Description: 在其他玩家放弃质疑时确认待定赢家，并清空所有待质疑标记。
 *
 * @param state 服务端私有游戏状态。
 * @return 已结束且写入 winnerPlayerId 的私有游戏状态。
 *
 * @Date 2026-06-12 14:47
 */
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
    turnDeadlineAt: null,
    updatedAt: Date.now(),
  };
}

/**
 * @Description: 基于座位快照和随机种子创建服务端私有对局状态，真实手牌只保存在这里。
 *
 * @param params 开局参数，包含比赛 ID、房间 ID、玩家列表和牌堆种子。
 * @return 初始私有游戏状态。
 *
 * @Date 2026-06-12 14:47
 */
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
    turnDeadlineAt: createTurnDeadline(now),
    lastPlay: null,
    turnSeq: 1,
    winnerPlayerId: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * @Description: 执行一次出牌，锁定或沿用声明牌点，并把真实牌面写入服务端弃牌堆。
 *
 * @param state 服务端私有游戏状态。
 * @param actorPlayerId 当前行动玩家 ID。
 * @param cardIds 玩家选择的手牌 ID 列表。
 * @param declaredRank 本轮首次出牌时声明的牌点。
 * @return 更新后的私有状态和可广播的公开事件。
 *
 * @Date 2026-06-12 14:47
 */
export function playCards(
  state: PrivateGameState,
  actorPlayerId: string,
  cardIds: string[],
  declaredRank?: DeclaredRank,
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

  const wasFollowingDeclaredRank = Boolean(state.lastPlay);
  const effectiveDeclaredRank = resolveDeclaredRank(state, declaredRank);
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
  const now = Date.now();
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
    turnDeadlineAt: createTurnDeadline(now),
    lastPlay: {
      playerId: actorPlayerId,
      declaredRank: effectiveDeclaredRank,
      cardCount: selectedCards.length,
      actualCards: selectedCards,
      timestamp: now,
    },
    turnSeq,
    winnerPlayerId: null,
    updatedAt: now,
  };

  return {
    state: nextState,
    event: {
      type: "cards_played",
      actorPlayerId,
      playMode: wasFollowingDeclaredRank ? "follow" : "declare",
      declaredRank: effectiveDeclaredRank,
      cardCount: selectedCards.length,
      turnSeq,
    },
  };
}

/**
 * @Description: 结算一次质疑，揭示上一手真实牌面，并按质疑结果决定拿牌人与下一行动方。
 *
 * @param state 服务端私有游戏状态。
 * @param challengerPlayerId 发起质疑的玩家 ID。
 * @return 更新后的私有状态和质疑结算事件。
 *
 * @Date 2026-06-12 14:47
 */
export function challengeLastPlay(state: PrivateGameState, challengerPlayerId: string): ChallengeResult {
  if (state.status !== "playing") {
    throw new Error("GAME_NOT_PLAYING");
  }

  if (!state.lastPlay) {
    throw new Error("NO_LAST_PLAY");
  }

  if (state.currentPlayerId !== challengerPlayerId) {
    throw new Error("NOT_YOUR_TURN");
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
  // 质疑成功时上一手玩家拿牌、质疑者继续；质疑失败时质疑者拿牌、上一手玩家继续。
  const pileTakenByPlayerId = wasTruthful ? challengerPlayerId : challengedPlayerId;
  const nextPlayerId = wasTruthful ? challengedPlayerId : challengerPlayerId;
  const now = Date.now();
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
    currentPlayerId: nextPlayerId,
    turnDeadlineAt: challengedPlayerWins ? null : createTurnDeadline(now),
    lastPlay: null,
    turnSeq,
    winnerPlayerId: challengedPlayerWins ? challengedPlayerId : null,
    updatedAt: now,
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

/**
 * @Description: 跟牌回合跳过当前玩家，并保留本轮声明点数和待质疑状态。
 *
 * @param state 服务端私有游戏状态。
 * @param actorPlayerId 当前行动玩家 ID。
 * @return 更新后的私有状态和跳过事件。
 *
 * @Date 2026-06-14 00:00
 */
export function skipTurn(state: PrivateGameState, actorPlayerId: string): SkipTurnResult {
  if (state.status !== "playing") {
    throw new Error("GAME_NOT_PLAYING");
  }

  if (state.currentPlayerId !== actorPlayerId) {
    throw new Error("NOT_YOUR_TURN");
  }

  if (!state.players.some((player) => player.playerId === actorPlayerId)) {
    throw new Error("PLAYER_NOT_IN_GAME");
  }

  if (!state.lastPlay) {
    throw new Error("CANNOT_SKIP_OPENING_TURN");
  }

  const nextPlayer = getNextPlayer(state.players, actorPlayerId);
  const now = Date.now();
  const turnSeq = state.turnSeq + 1;

  return {
    state: {
      ...state,
      players: updatePlayerPendingWin(state.players, null),
      currentPlayerId: nextPlayer.playerId,
      turnDeadlineAt: createTurnDeadline(now),
      turnSeq,
      updatedAt: now,
    },
    event: {
      type: "turn_skipped",
      actorPlayerId,
      turnSeq,
    },
  };
}

/**
 * @Description: 按观看者视角脱敏私有状态，只暴露自己的手牌和其他玩家的牌数。
 *
 * @param state 服务端私有游戏状态。
 * @param viewerPlayerId 当前接收状态的玩家 ID。
 * @return 可安全下发给单个玩家的公开游戏状态。
 *
 * @Date 2026-06-12 14:47
 */
export function toPublicGameState(state: PrivateGameState, viewerPlayerId: string): PublicGameState {
  // 每个玩家只能看到自己的手牌；其他玩家只暴露剩余牌数，避免泄露隐藏信息。

  const cardBackByPlayerId = new Map(state.players.map((player) => [player.playerId, player.seatIndex % 4]));

  const players = state.players.map((player) => ({
    ...player,
    cardCount: state.hands[player.playerId]?.length ?? 0,
    cardBack: cardBackByPlayerId.get(player.playerId) ?? 0,
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
    discardPileCards: state.discardPile.map((entry) => ({
      playedByPlayerId: entry.playedByPlayerId,
      turnSeq: entry.turnSeq,
      cardBack: cardBackByPlayerId.get(entry.playedByPlayerId) ?? 0,
    })),
    currentPlayerId: state.currentPlayerId,
    turnDeadlineAt: state.turnDeadlineAt ?? null,
    lastPlay,
    turnSeq: state.turnSeq,
    winnerPlayerId: state.winnerPlayerId,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  };
}
