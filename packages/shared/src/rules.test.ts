/**
 * 共享规则测试：验证牌堆、出牌、质疑和隐藏信息脱敏。
 */
import { describe, expect, it } from "vitest";
import { createDeck } from "./cards";
import {
  challengeLastPlay,
  createInitialGameState,
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
  },
  {
    playerId: "player-2",
    userId: "user-2",
    nickname: "玩家B",
    seatIndex: 1,
    connected: true,
    ready: true,
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
  it("creates one standard 52-card deck without jokers", () => {
    const deck = createDeck();

    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((card) => card.id))).toHaveLength(52);
    expect(deck.some((card) => card.rank === "A" && card.suit === "S")).toBe(true);
  });
});

describe("game rules", () => {
  it("plays selected cards face down and hides non-viewer hands", () => {
    const state = stateForTests();
    const cardIds = state.hands["player-1"].slice(0, 2).map((card) => card.id);
    const result = playCards(state, "player-1", cardIds);
    const publicState = toPublicGameState(result.state, "player-2");

    expect(result.event.declaredRank).toBe("A");
    expect(result.state.hands["player-1"]).toHaveLength(state.hands["player-1"].length - 2);
    expect(publicState.selfHand).toEqual(result.state.hands["player-2"]);
    expect(publicState.lastPlay).not.toHaveProperty("actualCards");
  });

  it("rejects cards that are not in the active player's hand", () => {
    const state = stateForTests();
    const opponentCard = state.hands["player-2"][0].id;

    expect(() => playCards(state, "player-1", [opponentCard])).toThrow("CARD_NOT_IN_HAND");
  });

  it("makes the bluffer take the pile when a bluff is challenged", () => {
    const state = stateForTests();
    const nonAce = state.hands["player-1"].find((card) => card.rank !== "A");

    expect(nonAce).toBeDefined();

    const played = playCards(state, "player-1", [nonAce!.id]);
    const challenged = challengeLastPlay(played.state, "player-2");

    expect(challenged.event.wasTruthful).toBe(false);
    expect(challenged.event.pileTakenByPlayerId).toBe("player-1");
    expect(challenged.state.discardPile).toHaveLength(0);
    expect(challenged.state.currentPlayerId).toBe("player-1");
  });
});
