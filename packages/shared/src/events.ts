/**
 * @Description: 共享事件类型：描述可以安全广播给玩家的公开游戏事件。
 *
 * @Date 2026-06-12 14:47
 */
import type { Card, DeclaredRank } from "./cards";

export type CardsPlayedEvent = {
  type: "cards_played";
  actorPlayerId: string;
  playMode?: "declare" | "follow";
  declaredRank: DeclaredRank;
  cardCount: number;
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

export type RoomLifecycleEvent = {
  type: "room_joined" | "room_left" | "room_owner_changed";
  playerId: string;
  nickname: string;
};

export type PublicGameEvent = CardsPlayedEvent | ChallengeResolvedEvent | PlayerConnectionEvent | RoomLifecycleEvent;
