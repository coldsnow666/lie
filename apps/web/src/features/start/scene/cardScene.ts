/**
 * @Description: 启动页与登录页共用的扑克牌编排：统一卡面、扇形角度和四角飞散轨迹。
 *
 * @Date 2026-06-12 14:47
 */
export type Suit = "S" | "H" | "D" | "C";

export type CardRank = "L" | "I" | "A" | "R";

export type BounceCard = {
  rank: CardRank;
  suit: Suit;
};

export type CornerFlight = {
  rank: CardRank;
  x: number | string;
  y: number | string;
  rotate: number;
};

export const defaultCards: BounceCard[] = [
  { rank: "L", suit: "D" },
  { rank: "I", suit: "S" },
  { rank: "A", suit: "C" },
  { rank: "R", suit: "H" },
];

export const defaultTransformStates = [
  { rotate: -18, x: -48, y: 2 },
  { rotate: -6, x: -16, y: -6 },
  { rotate: 6, x: 16, y: -6 },
  { rotate: 18, x: 48, y: 2 },
];

export const cornerFlights: CornerFlight[] = [
  { rank: "L", x: "-58vw", y: "-52vh", rotate: -42 },
  { rank: "I", x: "58vw", y: "-52vh", rotate: 42 },
  { rank: "A", x: "-58vw", y: "52vh", rotate: -42 },
  { rank: "R", x: "58vw", y: "52vh", rotate: 42 },
];

function roundFlightDistance(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * @Description: 按真实屏幕位置计算认证页扑克牌四角飞散距离，兼容非居中和缩放布局。
 *
 * @param cardShells 当前渲染出的四张牌元素。
 * @return 每张牌飞向视口角落所需的位移和旋转。
 *
 * @Date 2026-06-12 14:47
 */
export function resolveViewportCornerFlights(cardShells: HTMLElement[]): CornerFlight[] {
  return cornerFlights.map((flight, index) => {
    const shell = cardShells[index];

    if (!shell) {
      return {
        rank: flight.rank,
        x: 0,
        y: 0,
        rotate: flight.rotate,
      };
    }

    const rect = shell.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const scaleX = shell.offsetWidth > 0 ? rect.width / shell.offsetWidth : 1;
    const scaleY = shell.offsetHeight > 0 ? rect.height / shell.offsetHeight : 1;
    const targetCenterX = index === 0 || index === 2 ? -rect.width * 0.72 : window.innerWidth + rect.width * 0.72;
    const targetCenterY = index === 0 || index === 1 ? -rect.height * 0.72 : window.innerHeight + rect.height * 0.72;

    return {
      rank: flight.rank,
      x: roundFlightDistance((targetCenterX - centerX) / (scaleX || 1)),
      y: roundFlightDistance((targetCenterY - centerY) / (scaleY || 1)),
      rotate: flight.rotate,
    };
  });
}

/**
 * @Description: 生成启动页单张扑克牌的扇形 transform，支持悬停推开和转场拉直。
 *
 * @param index 牌在四张启动牌中的索引。
 * @param options 拉直和横向推开配置。
 * @return 可直接写入 CSS transform 的字符串。
 *
 * @Date 2026-06-12 14:47
 */
export function cardTransform(index: number, options: { straighten?: boolean; push?: number } = {}) {
  const state = defaultTransformStates[index] ?? { rotate: 0, x: 0, y: 0 };
  const x = Math.max(-100, Math.min(100, state.x + (options.push ?? 0)));
  const y = options.straighten ? state.y - 18 : state.y;
  const rotate = options.straighten ? state.rotate * 0.35 : state.rotate;

  return `translateX(${x}%) translateY(${y}%) rotate(${rotate}deg)`;
}
