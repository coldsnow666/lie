/**
 * 启动页与登录页共用的扑克牌编排：统一卡面、扇形角度和四角飞散轨迹。
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
 * 认证页的扑克牌不在视口中心，还会整体缩放，所以飞行距离要按真实屏幕位置动态换算。
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

export function cardTransform(index: number, options: { straighten?: boolean; push?: number } = {}) {
  const state = defaultTransformStates[index] ?? { rotate: 0, x: 0, y: 0 };
  const x = Math.max(-100, Math.min(100, state.x + (options.push ?? 0)));
  const y = options.straighten ? state.y - 18 : state.y;
  const rotate = options.straighten ? state.rotate * 0.35 : state.rotate;

  return `translateX(${x}%) translateY(${y}%) rotate(${rotate}deg)`;
}
