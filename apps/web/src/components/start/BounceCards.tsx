/**
 * ReactBits Bounce Cards 效果：启动页扑克牌弹性展开并支持悬停推开。
 */
"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

type Suit = "S" | "H" | "D" | "C";

type BounceCard = {
  rank: string;
  suit: Suit;
};

type BounceCardsProps = {
  className?: string;
  cards?: BounceCard[];
  animationDelay?: number;
  animationStagger?: number;
  enableHover?: boolean;
  playIntro?: boolean;
};

const defaultCards: BounceCard[] = [
  { rank: "L", suit: "S" },
  { rank: "I", suit: "H" },
  { rank: "A", suit: "D" },
  { rank: "R", suit: "C" },
];

const defaultTransformStates = [
  { rotate: -18, x: -48, y: 2 },
  { rotate: -6, x: -16, y: -6 },
  { rotate: 6, x: 16, y: -6 },
  { rotate: 18, x: 48, y: 2 },
];

const suitMap = {
  S: { symbol: "♠", color: "#173b2a" },
  H: { symbol: "♥", color: "#b93131" },
  D: { symbol: "♦", color: "#b93131" },
  C: { symbol: "♣", color: "#173b2a" },
};

function cardTransform(index: number, options: { straighten?: boolean; push?: number } = {}) {
  const state = defaultTransformStates[index] ?? { rotate: 0, x: 0, y: 0 };
  const x = Math.max(-100, Math.min(100, state.x + (options.push ?? 0)));
  const y = options.straighten ? state.y - 18 : state.y;
  const rotate = options.straighten ? state.rotate * 0.35 : state.rotate;

  return `translateX(${x}%) translateY(${y}%) rotate(${rotate}deg)`;
}

export default function BounceCards({
  className = "",
  cards = defaultCards,
  animationDelay = 0.24,
  animationStagger = 0.055,
  enableHover = true,
  playIntro = true,
}: BounceCardsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const context = gsap.context(() => {
      const startFloat = () => {
        gsap.to(".lie-bounce-card-face", {
          y: (index) => [-7, -4, -8, -5, -6][index] ?? -6,
          rotateZ: (index) => [1.4, -1.2, 0.8, -1.5, 1][index] ?? 1,
          duration: (index) => [1.35, 1.5, 1.42, 1.62, 1.48][index] ?? 1.5,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          stagger: 0.08,
        });
      };

      if (!playIntro) {
        gsap.set(".lie-bounce-card", { scale: 1, y: 0, opacity: 1 });
        startFloat();
        return;
      }

      const intro = gsap.fromTo(
        ".lie-bounce-card",
        { scale: 0, y: 28, opacity: 0 },
        {
          scale: 1,
          y: 0,
          opacity: 1,
          stagger: animationStagger,
          ease: "elastic.out(1, 0.78)",
          delay: animationDelay,
        },
      );
      intro.then(startFloat);
    }, containerRef);

    return () => context.revert();
  }, [animationDelay, animationStagger, playIntro]);

  function pushSiblings(hoveredIndex: number) {
    if (!enableHover || !containerRef.current) {
      return;
    }

    const select = gsap.utils.selector(containerRef);
    cards.forEach((_, index) => {
      const target = select(`.lie-bounce-card-${index}`);
      gsap.killTweensOf(target);

      const nextTransform = index === hoveredIndex ? cardTransform(index, { straighten: true }) : cardTransform(index, { push: index < hoveredIndex ? -18 : 18 });

      gsap.to(target, {
        transform: nextTransform,
        duration: 0.38,
        ease: "back.out(1.35)",
        delay: index === hoveredIndex ? 0 : Math.abs(hoveredIndex - index) * 0.04,
        overwrite: "auto",
      });
    });
  }

  function resetSiblings() {
    if (!enableHover || !containerRef.current) {
      return;
    }

    const select = gsap.utils.selector(containerRef);
    cards.forEach((_, index) => {
      const target = select(`.lie-bounce-card-${index}`);
      gsap.killTweensOf(target);
      gsap.to(target, {
        transform: cardTransform(index),
        duration: 0.38,
        ease: "back.out(1.35)",
        overwrite: "auto",
      });
    });
  }

  return (
    <div ref={containerRef} className={`relative h-full w-full ${className}`}>
      {cards.map((card, index) => {
        const suit = suitMap[card.suit];

        return (
          <div
            key={`${card.rank}-${card.suit}-${index}`}
            className="absolute left-1/2 top-1/2 h-[clamp(7.5rem,24vw,14.5rem)] w-[clamp(5.25rem,16.5vw,9.9rem)] -translate-x-1/2 -translate-y-1/2"
          >
            <div data-bounce-card-flight={card.rank} className="h-full w-full">
              <button
                type="button"
                aria-label={`${card.rank}${suit.symbol}`}
                onMouseEnter={() => pushSiblings(index)}
                onMouseLeave={resetSiblings}
                onFocus={() => pushSiblings(index)}
                onBlur={resetSiblings}
                className={`lie-bounce-card lie-bounce-card-${index} h-full w-full cursor-pointer overflow-hidden rounded border-2 border-[#e8ddb7] bg-[#f7f0dc] p-3 text-left shadow-2xl shadow-black/45 outline-none transition-[filter] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[#f0d98d]`}
                style={{ transform: cardTransform(index), transformOrigin: "50% 92%" }}
              >
                <span className="lie-bounce-card-face flex h-full w-full flex-col">
                  <span className="block text-[clamp(2.2rem,7.2vw,4.1rem)] font-black leading-none" style={{ color: suit.color }}>
                    {card.rank}
                  </span>
                  <span className="grid flex-1 place-items-center pb-1 text-[clamp(3.4rem,11vw,6.7rem)] leading-none" style={{ color: suit.color }}>
                    {suit.symbol}
                  </span>
                </span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
