/**
 * @Description: 游戏牌桌组件拆分后的共享类型，统一约束动画计划、弃牌展示和质疑回收状态。
 *
 * @Date 2026-06-12 14:47
 */
import type { Card, PublicGameEvent, PublicGameState } from "@lie/shared";

export type GamePlayer = PublicGameState["players"][number];
export type PublicDiscardCard = PublicGameState["discardPileCards"][number];
export type VisibleCardCounts = Record<string, number>;

export type DealFlightCard = {
  id: string;
  playerId: string;
  cardBack: number;
  selfCard?: Card;
  orderIndex: number;
  targetIndex: number;
};

export type PlayFlightCard = {
  id: string;
  card: Card;
  cardBack: number;
  startLeft: number;
  startTop: number;
  startWidth: number;
  startHeight: number;
  startRotate: number;
  targetLeft: number;
  targetTop: number;
  targetWidth: number;
  targetHeight: number;
  targetRotate: number;
  zIndex: number;
};

export type ReturnFlightCard = {
  id: string;
  cardBack: number;
  revealCard?: Card;
  playerId: string;
  sourceIndex: number;
  sourcePlayedByPlayerId: string;
  sourceTurnSeq: number;
  startX: number;
  startY: number;
  startRotate: number;
  targetSelf: boolean;
  targetIndex: number;
  zIndex: number;
};

export type DiscardGroupMeta = {
  cardIndex: number;
  cardCount: number;
  groupIndex: number;
};

export type DealFlightTargetPose = {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  visible: boolean;
};

export type DisplayDiscardCard = PublicDiscardCard & {
  revealCard?: Card;
};

export type ChallengeResolvedGameEvent = Extract<PublicGameEvent, { type: "challenge_resolved" }>;

export type PendingReturnBatch = {
  displayDiscardCards: DisplayDiscardCard[];
  flights: ReturnFlightCard[];
  returnRevealSelfCards: Card[];
  returnHiddenSelfCardIds: string[];
  returnTargetCardCounts: VisibleCardCounts;
  returnTargetSelfCards: Card[];
  turnSeq: number;
};

export type ChallengeReturnPlan = {
  batch: PendingReturnBatch;
  challengeEvent: ChallengeResolvedGameEvent;
  challengeResult: ChallengeResolvedGameEvent | null;
  displayCards: DisplayDiscardCard[];
  phase: "announce" | "result";
};

export type ReturnTargetPlan = {
  challengeResult?: ChallengeResolvedGameEvent | null;
  returnHiddenSelfCardIds: string[];
  returnTargetCardCounts: VisibleCardCounts;
  returnTargetSelfCards: Card[];
  turnSeq: number;
};
