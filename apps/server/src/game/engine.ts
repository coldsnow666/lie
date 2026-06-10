/**
 * 游戏服务端规则出口：复用 shared 中的纯游戏引擎。
 */
export {
  challengeLastPlay,
  createInitialGameState,
  finalizePendingWinner,
  findPendingWinner,
  getNextPlayer,
  isTruthfulPlay,
  playCards,
} from "@lie/shared";
