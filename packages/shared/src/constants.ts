/**
 * 共享常量：牌面顺序、玩家数量和单次出牌数量限制。
 */
export const SUITS = ["S", "H", "D", "C"] as const;
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const MIN_PLAY_CARDS = 1;
export const MAX_PLAY_CARDS = 4;

export const GAME_VERSION = "v0.1.0";
