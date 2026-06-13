/**
 * @Description: 游戏牌桌动画和布局常量，避免主组件散落时长、间距和散牌姿态配置。
 *
 * @Date 2026-06-12 14:47
 */
export const DISCARD_CARD_STAGGER_SECONDS = 0.072;
export const DISCARD_CARD_FLIGHT_SECONDS = 0.58;
export const CHALLENGE_REVEAL_HOLD_SECONDS = 1.35;
export const DISCARD_RETURN_STAGGER_SECONDS = 0.038;
export const DISCARD_RETURN_FLIGHT_SECONDS = 0.72;
export const DEAL_CARD_FLIGHT_SECONDS = 0.82;
export const DEAL_CARD_STAGGER_SECONDS = 0.105;

export const DECLARE_RANK_CARD_GAP = 12;
export const DECLARE_RANK_CARD_PADDING = 12;
export const DECLARE_RANK_MODAL_CHROME_WIDTH = 48;
export const DECLARE_RANK_MODAL_CHROME_HEIGHT = 120;
export const DECLARE_RANK_COLUMN_OPTIONS = [5, 4, 3] as const;

export const DISCARD_POSE_PATTERN = [
  { x: -31, y: -15, rotate: -11 },
  { x: 19, y: -21, rotate: 8 },
  { x: -7, y: 10, rotate: -4 },
  { x: 42, y: 4, rotate: 15 },
  { x: -48, y: 18, rotate: -22 },
  { x: 7, y: -36, rotate: 18 },
  { x: 32, y: 25, rotate: -8 },
  { x: -18, y: 34, rotate: 12 },
] as const;
