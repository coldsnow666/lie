/**
 * @Description: 手牌分组、缩放和扇形排布计算。
 *
 * @Date 2026-06-14 00:00
 */
import { isJokerRank, sortHandCards, type Card as CardType, type StandardSuit } from "@lie/shared";

export const HAND_GROUP_STEP = 9;

const CARD_BASE_WIDTH = 49;
const CARD_BASE_HEIGHT = 65;
const HAND_CARD_MAX_SCALE = 2.35;
const HAND_CARD_MIN_SCALE = 0.78;
const HAND_STACK_STEP = 16;
const HAND_FAN_MAX_ROTATE = 14;
const HAND_FAN_MAX_LIFT = 12;
const HAND_VERTICAL_PADDING = 36;
const HAND_VIEWPORT_HEIGHT_RATIO = 0.34;
const HAND_VIEWPORT_MIN_HEIGHT = 132;
const HAND_VIEWPORT_MAX_HEIGHT = 286;
const suitStackWeight = new Map<StandardSuit, number>([
  ["D", 0],
  ["C", 1],
  ["H", 2],
  ["S", 3],
]);

type HandGroup = {
  key: string;
  cards: CardType[];
};

function getHandGroupKey(card: CardType) {
  return isJokerRank(card.rank) ? "JOKER" : card.rank;
}

function sortStackCards(cards: CardType[]) {
  if (cards.some((card) => isJokerRank(card.rank))) {
    return [...cards].sort((left, right) => (left.rank === "RED_JOKER" ? 0 : 1) - (right.rank === "RED_JOKER" ? 0 : 1));
  }

  return [...cards].sort(
    (left, right) => (suitStackWeight.get(left.suit as StandardSuit) ?? 0) - (suitStackWeight.get(right.suit as StandardSuit) ?? 0),
  );
}

/**
 * @Description: 按牌点把手牌分成堆，并在每堆内按花色或大小王顺序稳定排序。
 *
 * @param cards 当前可展示的手牌。
 * @return 用于渲染堆叠扇形手牌的分组列表。
 *
 * @Date 2026-06-12 14:47
 */
export function groupHandCards(cards: CardType[]) {
  const groups = new Map<string, HandGroup>();

  for (const card of sortHandCards(cards)) {
    const key = getHandGroupKey(card);
    const group = groups.get(key);

    if (group) {
      group.cards.push(card);
      continue;
    }

    groups.set(key, {
      key,
      cards: [card],
    });
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    cards: sortStackCards(group.cards),
  }));
}

/**
 * @Description: 回收弃牌预占位时，同点数内让已有手牌保持下层，回来的牌只占上层空位。
 *
 * @param cards 回收完成后的目标完整手牌。
 * @param visibleCardIds 当前已经在手牌区可见的牌 ID。
 * @return 适合回收动画目标占位的手牌分组。
 *
 * @Date 2026-06-13 22:10
 */
export function groupReturnTargetCards(cards: CardType[], visibleCardIds: Set<string>) {
  return groupHandCards(cards).map((group) => ({
    ...group,
    cards: [
      ...group.cards.filter((card) => visibleCardIds.has(card.id)),
      ...group.cards.filter((card) => !visibleCardIds.has(card.id)),
    ],
  }));
}

function getHandMaxHeight(viewportHeight: number) {
  if (!viewportHeight) {
    return Infinity;
  }

  return Math.min(
    Math.max(viewportHeight * HAND_VIEWPORT_HEIGHT_RATIO, HAND_VIEWPORT_MIN_HEIGHT),
    HAND_VIEWPORT_MAX_HEIGHT,
  );
}

function getHandHeightBase(maxStackSize: number) {
  return CARD_BASE_HEIGHT + HAND_FAN_MAX_LIFT + HAND_STACK_STEP * Math.max(0, maxStackSize - 1);
}

function getHeightFittedScale(viewportHeight: number, maxStackSize: number) {
  const maxHeight = getHandMaxHeight(viewportHeight);

  if (!Number.isFinite(maxHeight)) {
    return HAND_CARD_MAX_SCALE;
  }

  return Math.max((maxHeight - HAND_VERTICAL_PADDING) / getHandHeightBase(maxStackSize), HAND_CARD_MIN_SCALE);
}

/**
 * @Description: 同时根据容器宽度和视口高度计算手牌缩放，避免手机横屏或小屏裁切。
 *
 * @param containerWidth 手牌容器宽度。
 * @param viewportHeight 当前可视高度。
 * @param groupCount 手牌分组数量。
 * @param maxStackSize 最大单组堆叠数量。
 * @return CSS 变量使用的牌面缩放值。
 *
 * @Date 2026-06-12 14:47
 */
export function getHandScale(containerWidth: number, viewportHeight: number, groupCount: number, maxStackSize: number) {
  if (!containerWidth || groupCount < 1) {
    return 1;
  }

  const heightFittedScale = getHeightFittedScale(viewportHeight, maxStackSize);

  if (groupCount <= 2) {
    return Math.min(HAND_CARD_MAX_SCALE, heightFittedScale);
  }

  const availableWidth = Math.max(containerWidth - getHandEdgePadding(containerWidth) * 2, CARD_BASE_WIDTH);
  const handBaseWidth = CARD_BASE_WIDTH + HAND_GROUP_STEP * Math.max(0, groupCount - 1);
  const fittedScale = availableWidth / handBaseWidth;

  return Math.min(Math.max(fittedScale, HAND_CARD_MIN_SCALE), HAND_CARD_MAX_SCALE, heightFittedScale);
}

export function getHandEdgePadding(containerWidth: number) {
  return Math.min(Math.max(containerWidth * 0.064, 18), 30);
}

export function getHandHeight(scale: number, maxStackSize: number) {
  return getHandHeightBase(maxStackSize) * scale + HAND_VERTICAL_PADDING;
}

function getFanProgress(groupIndex: number, groupCount: number) {
  if (groupCount <= 1) {
    return 0;
  }

  const center = (groupCount - 1) / 2;
  const distanceFromCenter = Math.abs(groupIndex - center) / Math.max(center, 1);
  return 1 - distanceFromCenter;
}

export function getFanRotate(groupIndex: number, groupCount: number) {
  if (groupCount <= 1) {
    return 0;
  }

  const center = (groupCount - 1) / 2;
  return ((groupIndex - center) / center) * HAND_FAN_MAX_ROTATE;
}

export function getFanLift(groupIndex: number, groupCount: number, scale: number) {
  return Math.sin((getFanProgress(groupIndex, groupCount) * Math.PI) / 2) * HAND_FAN_MAX_LIFT * scale;
}

export function getStackOffset(rotate: number, stackIndex: number, scale: number) {
  const distance = stackIndex * HAND_STACK_STEP * scale;
  const radians = (rotate * Math.PI) / 180;

  return {
    x: Math.sin(radians) * distance,
    y: Math.cos(radians) * distance,
  };
}
