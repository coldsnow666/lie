/**
 * ReactBits Bounce Cards 效果：启动页扑克牌弹性展开并支持悬停推开。
 */
"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import DomPlayingCard from "@/components/game/DomPlayingCard";
import { cardTransform, cornerFlights, defaultCards, resolveViewportCornerFlights, type BounceCard, type Suit } from "./cardScene";

type BounceCardsProps = {
  className?: string;
  cards?: BounceCard[];
  animationDelay?: number;
  animationStagger?: number;
  enableHover?: boolean;
  playIntro?: boolean;
  introVariant?: "pop" | "corner-return";
  introFlightMode?: "shared" | "viewport";
  managedShellMotion?: boolean;
};

const suitMap: Record<Suit, string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
};

const startCardScaleStyle = {
  "--start-card-scale": "calc(clamp(5.25rem, 16.5vw, 9.9rem) / 49px)",
} as CSSProperties;

export default function BounceCards({
  className = "",
  cards = defaultCards,
  animationDelay = 0.24,
  animationStagger = 0.055,
  enableHover = true,
  playIntro = true,
  introVariant = "pop",
  introFlightMode = "shared",
  managedShellMotion = false,
}: BounceCardsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const context = gsap.context(() => {
      const select = gsap.utils.selector(containerRef);
      const cardShells = select(".lie-bounce-card-flight-shell");
      const cardNodes = select(".lie-bounce-card");

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
        if (!managedShellMotion) {
          gsap.set(cardShells, { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 });
        }
        gsap.set(cardNodes, { scale: 1, y: 0, opacity: 1 });
        startFloat();
        return;
      }

      gsap.set(cardShells, {
        force3D: true,
        willChange: "transform, opacity",
      });

      if (introVariant === "corner-return") {
        const flightPlan =
          introFlightMode === "viewport"
            ? resolveViewportCornerFlights(cardShells.filter((shell): shell is HTMLElement => shell instanceof HTMLElement))
            : cornerFlights;
        const intro = gsap.timeline({
          delay: animationDelay,
        });

        cardShells.forEach((shell, index) => {
          intro.fromTo(
            shell,
            {
              x: flightPlan[index]?.x ?? 0,
              y: flightPlan[index]?.y ?? 0,
              rotate: flightPlan[index]?.rotate ?? 0,
              scale: 0.92,
              opacity: 0,
            },
            {
              x: 0,
              y: 0,
              rotate: 0,
              scale: 1,
              opacity: 1,
              duration: 0.84,
              ease: "power3.out",
            },
            index * animationStagger,
          );
        });

        intro.then(startFloat);
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
  }, [animationDelay, animationStagger, introFlightMode, introVariant, managedShellMotion, playIntro]);

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
        const suitSymbol = suitMap[card.suit];
        const playingCard = {
          id: `start-${card.rank}-${card.suit}`,
          rank: "A",
          suit: card.suit,
        } as const;

        return (
          <div
            key={`${card.rank}-${card.suit}-${index}`}
            className="absolute left-1/2 top-1/2 aspect-[49/65] w-[clamp(5.25rem,16.5vw,9.9rem)] -translate-x-1/2 -translate-y-1/2"
            style={startCardScaleStyle}
          >
            <div data-bounce-card-flight={card.rank} className="lie-bounce-card-flight-shell h-full w-full">
              <button
                type="button"
                aria-label={`${card.rank}${suitSymbol}`}
                onMouseEnter={() => pushSiblings(index)}
                onMouseLeave={resetSiblings}
                onFocus={() => pushSiblings(index)}
                onBlur={resetSiblings}
                className={`lie-bounce-card lie-bounce-card-${index} grid h-full w-full cursor-pointer place-items-center bg-transparent outline-none transition-[filter] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[#f0d98d]`}
                style={{ transform: cardTransform(index), transformOrigin: "50% 92%" }}
              >
                <span className="lie-bounce-card-face block h-full w-full drop-shadow-2xl">
                  <DomPlayingCard card={playingCard} displayRank={card.rank} className="[--pixel-card-scale:var(--start-card-scale)]" />
                </span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
