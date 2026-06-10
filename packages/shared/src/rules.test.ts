/**
 * 共享规则测试：验证牌堆、出牌、质疑和隐藏信息脱敏。
 */
import { describe, expect, it } from "vitest";
import { createDeck, createGameDeck, sortHandCards } from "./cards";
import {
  challengeLastPlay,
  createInitialGameState,
  finalizePendingWinner,
  isTruthfulPlay,
  playCards,
  toPublicGameState,
  type Player,
} from "./rules";

const players: Player[] = [
  {
    playerId: "player-1",
    userId: "user-1",
    nickname: "玩家A",
    seatIndex: 0,
    connected: true,
    ready: true,
    pendingWin: false,
  },
  {
    playerId: "player-2",
    userId: "user-2",
    nickname: "玩家B",
    seatIndex: 1,
    connected: true,
    ready: true,
    pendingWin: false,
  },
];

function stateForTests() {
  return createInitialGameState({
    matchId: "match-1",
    roomId: "room-1",
    players,
    seed: "test-seed",
    now: 1,
  });
}

describe("cards", () => {
  it("creates one 54-card deck with jokers", () => {
    const deck = createDeck();

    expect(deck).toHaveLength(54);
    expect(new Set(deck.map((card) => card.id))).toHaveLength(54);
    expect(deck.some((card) => card.rank === "A" && card.suit === "S")).toBe(true);
    expect(deck.some((card) => card.rank === "BLACK_JOKER")).toBe(true);
    expect(deck.some((card) => card.rank === "RED_JOKER")).toBe(true);
  });

  it("creates fixed game decks from random full-rank subsets", () => {
    const twoPlayerDeck = createGameDeck(2, "two-player-seed");
    const threePlayerDeck = createGameDeck(3, "three-player-seed");

    expect(twoPlayerDeck).toHaveLength(22);
    expect(new Set(twoPlayerDeck.filter((card) => card.suit !== "JOKER").map((card) => card.rank))).toHaveLength(5);
    expect(twoPlayerDeck.filter((card) => card.suit === "JOKER")).toHaveLength(2);

    expect(threePlayerDeck).toHaveLength(34);
    expect(new Set(threePlayerDeck.filter((card) => card.suit !== "JOKER").map((card) => card.rank))).toHaveLength(8);
    expect(threePlayerDeck.filter((card) => card.suit === "JOKER")).toHaveLength(2);
  });

  it("sorts hands by jokers first and ranks descending", () => {
    const sorted = sortHandCards([
      { id: "3D", rank: "3", suit: "D" },
      { id: "KS", rank: "K", suit: "S" },
      { id: "BJ", rank: "BLACK_JOKER", suit: "JOKER" },
      { id: "10H", rank: "10", suit: "H" },
      { id: "RJ", rank: "RED_JOKER", suit: "JOKER" },
      { id: "AS", rank: "A", suit: "S" },
      { id: "QH", rank: "Q", suit: "H" },
      { id: "9C", rank: "9", suit: "C" },
      { id: "JD", rank: "J", suit: "D" },
    ]);

    expect(sorted.map((card) => card.rank)).toEqual([
      "RED_JOKER",
      "BLACK_JOKER",
      "K",
      "Q",
      "J",
      "10",
      "9",
      "3",
      "A",
    ]);
  });
});

describe("game rules", () => {
  it("plays selected cards face down and hides non-viewer hands", () => {
    const state = stateForTests();
    const cardIds = state.hands["player-1"].slice(0, 2).map((card) => card.id);
    const result = playCards(state, "player-1", cardIds, "A");
    const publicState = toPublicGameState(result.state, "player-2");

    expect(result.event.declaredRank).toBe("A");
    expect(result.state.hands["player-1"]).toHaveLength(state.hands["player-1"].length - 2);
    expect(publicState.selfHand).toEqual(sortHandCards(result.state.hands["player-2"]));
    expect(publicState.lastPlay).not.toHaveProperty("actualCards");
  });

  it("deals eleven-card hands and keeps undealt cards hidden", () => {
    const twoPlayerState = stateForTests();
    const threePlayerState = createInitialGameState({
      matchId: "match-3",
      roomId: "room-3",
      players: [
        ...players,
        {
          playerId: "player-3",
          userId: "user-3",
          nickname: "玩家C",
          seatIndex: 2,
          connected: true,
          ready: true,
          pendingWin: false,
        },
      ],
      seed: "three-player-state-seed",
      now: 1,
    });
    const publicState = toPublicGameState(threePlayerState, "player-1");

    expect(twoPlayerState.hands["player-1"]).toHaveLength(11);
    expect(twoPlayerState.hands["player-2"]).toHaveLength(11);
    expect(twoPlayerState.undealtCards).toHaveLength(0);

    expect(threePlayerState.hands["player-1"]).toHaveLength(11);
    expect(threePlayerState.hands["player-2"]).toHaveLength(11);
    expect(threePlayerState.hands["player-3"]).toHaveLength(11);
    expect(threePlayerState.undealtCards).toHaveLength(1);
    expect(publicState).not.toHaveProperty("undealtCards");
  });

  it("rejects cards that are not in the active player's hand", () => {
    const state = stateForTests();
    const opponentCard = state.hands["player-2"][0].id;

    expect(() => playCards(state, "player-1", [opponentCard], "A")).toThrow("CARD_NOT_IN_HAND");
  });

  it("makes the bluffer take the pile when a bluff is challenged", () => {
    const state = stateForTests();
    const nonAce = state.hands["player-1"].find((card) => card.rank !== "A");

    expect(nonAce).toBeDefined();

    const played = playCards(state, "player-1", [nonAce!.id], "A");
    const challenged = challengeLastPlay(played.state, "player-2");

    expect(challenged.event.wasTruthful).toBe(false);
    expect(challenged.event.pileTakenByPlayerId).toBe("player-1");
    expect(challenged.state.discardPile).toHaveLength(0);
    expect(challenged.state.currentPlayerId).toBe("player-1");
  });

  it("treats jokers as wild cards when checking declared rank", () => {
    expect(
      isTruthfulPlay(
        [
          { id: "QS", rank: "Q", suit: "S" },
          { id: "BJ", rank: "BLACK_JOKER", suit: "JOKER" },
          { id: "RJ", rank: "RED_JOKER", suit: "JOKER" },
        ],
        "Q",
      ),
    ).toBe(true);
  });

  it("keeps a zero-card player pending until the table lets the play stand", () => {
    const state = stateForTests();
    const winningCard = state.hands["player-1"][0];
    state.hands["player-1"] = [winningCard];

    const played = playCards(state, "player-1", [winningCard.id], winningCard.rank === "BLACK_JOKER" || winningCard.rank === "RED_JOKER" ? "A" : winningCard.rank);
    expect(played.state.status).toBe("playing");
    expect(played.state.winnerPlayerId).toBeNull();
    expect(played.state.players.find((player) => player.playerId === "player-1")?.pendingWin).toBe(true);

    const finished = finalizePendingWinner(played.state);
    expect(finished.status).toBe("finished");
    expect(finished.winnerPlayerId).toBe("player-1");
  });
});
