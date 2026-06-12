/**
 * @Description: 声明牌点弹窗的响应式卡牌网格布局计算。
 *
 * @Date 2026-06-12 14:47
 */
import { DECLARABLE_RANKS } from "@lie/shared";
import {
  DECLARE_RANK_CARD_GAP,
  DECLARE_RANK_CARD_PADDING,
  DECLARE_RANK_COLUMN_OPTIONS,
  DECLARE_RANK_MODAL_CHROME_HEIGHT,
  DECLARE_RANK_MODAL_CHROME_WIDTH,
} from "./gameTableConstants";

export function getDeclareRankCardLayout() {
  if (typeof window === "undefined") {
    return { columns: 5, scale: 1.45 };
  }

  const availableWidth = Math.min(window.innerWidth - DECLARE_RANK_MODAL_CHROME_WIDTH, 896);
  const availableHeight = window.innerHeight - DECLARE_RANK_MODAL_CHROME_HEIGHT;
  const layouts = DECLARE_RANK_COLUMN_OPTIONS.map((columns) => {
    const rowCount = Math.ceil(DECLARABLE_RANKS.length / columns);
    const scaleByWidth = (availableWidth - DECLARE_RANK_CARD_PADDING * 2 - DECLARE_RANK_CARD_GAP * (columns - 1)) / (49 * columns);
    const scaleByHeight = (availableHeight - DECLARE_RANK_CARD_PADDING * 2 - DECLARE_RANK_CARD_GAP * (rowCount - 1)) / (65 * rowCount);

    return {
      columns,
      scale: Math.max(0.82, Math.min(2.75, scaleByWidth, scaleByHeight)),
    };
  });

  return layouts.reduce((best, layout) => (layout.scale > best.scale ? layout : best), layouts[0]);
}
