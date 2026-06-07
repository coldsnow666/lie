/**
 * 共享事件类型：描述可以安全广播给玩家的公开游戏事件。
 */
import type { Card, Rank } from "./cards";

export type CardsPlayedEvent = {
  type: "cards_played";
  actorPlayerId: string;
  declaredRank: Rank;
  declaredCount: number;
  turnSeq: number;
};

export type ChallengeResolvedEvent = {
  type: "challenge_resolved";
  challengerPlayerId: string;
  challengedPlayerId: string;
  wasTruthful: boolean;
  revealedCards: Card[];
  pileTakenByPlayerId: string;
  turnSeq: number;
};

export type PlayerConnectionEvent = {
  type: "player_connected" | "player_disconnected";
  playerId: string;
};

export type PublicGameEvent = CardsPlayedEvent | ChallengeResolvedEvent | PlayerConnectionEvent;
