/**
 * 启动页转场动画：封装扑克牌四角飞散、按钮下退和反向入场。
 */
"use client";

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { gsap } from "gsap";

type CardRank = "L" | "I" | "A" | "R";

type CornerFlight = {
  rank: CardRank;
  x: string;
  y: string;
  rotate: number;
};

const cornerFlights: CornerFlight[] = [
  { rank: "L", x: "-58vw", y: "-52vh", rotate: -42 },
  { rank: "I", x: "58vw", y: "-52vh", rotate: 42 },
  { rank: "A", x: "-58vw", y: "52vh", rotate: -42 },
  { rank: "R", x: "58vw", y: "52vh", rotate: 42 },
];

type TransitionTargets = {
  cards: HTMLElement[];
  menu: HTMLElement;
};

function resolveTargets(cardRegion: HTMLElement | null, menu: HTMLElement | null): TransitionTargets | null {
  if (!cardRegion || !menu) {
    return null;
  }

  const cards = cornerFlights
    .map((flight) => cardRegion.querySelector<HTMLElement>(`[data-bounce-card-flight="${flight.rank}"]`))
    .filter((card): card is HTMLElement => Boolean(card));

  if (cards.length !== cornerFlights.length) {
    return null;
  }

  return { cards, menu };
}

function prepareCompositedMotion(targets: TransitionTargets) {
  // 转场只改 transform 和 opacity，提前提示浏览器合成层，降低移动端和低配设备卡顿。
  gsap.set([...targets.cards, targets.menu], {
    force3D: true,
    willChange: "transform, opacity",
  });
}

export function useStartScreenTransition(): {
  cardRegionRef: RefObject<HTMLDivElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
  playExit: (onComplete: () => void) => void;
  transitioning: boolean;
} {
  const cardRegionRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const activeTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const transitioningRef = useRef(false);
  const [transitioning, setTransitioning] = useState(false);

  const createTimeline = useCallback((onComplete?: () => void) => {
    const targets = resolveTargets(cardRegionRef.current, menuRef.current);

    if (!targets) {
      return null;
    }

    prepareCompositedMotion(targets);

    return gsap
      .timeline({
        paused: true,
        defaults: { overwrite: "auto" },
        onComplete,
      })
      .to(targets.cards, {
        x: (index) => cornerFlights[index]?.x ?? "0",
        y: (index) => cornerFlights[index]?.y ?? "-52vh",
        rotate: (index) => cornerFlights[index]?.rotate ?? 0,
        scale: 0.92,
        opacity: 0,
        duration: 0.68,
        ease: "power3.in",
        stagger: 0.032,
      })
      .to(
        targets.menu,
        {
          y: "18vh",
          opacity: 0,
          duration: 0.28,
          ease: "power2.in",
        },
        "-=0.12",
      );
  }, []);

  useLayoutEffect(() => {
    const timeline = createTimeline();

    if (!timeline) {
      return undefined;
    }

    activeTimelineRef.current = timeline;
    // 进入启动页时从退出终点反向播放，保持进入/退出使用同一套动效。
    timeline.progress(1).reverse();

    return () => {
      timeline.kill();
      if (activeTimelineRef.current === timeline) {
        activeTimelineRef.current = null;
      }
    };
  }, [createTimeline]);

  const playExit = useCallback(
    (onComplete: () => void) => {
      if (transitioningRef.current) {
        return;
      }

      const timeline = createTimeline(onComplete);

      if (!timeline) {
        onComplete();
        return;
      }

      activeTimelineRef.current?.kill();
      activeTimelineRef.current = timeline;
      transitioningRef.current = true;
      setTransitioning(true);
      timeline.play(0);
    },
    [createTimeline],
  );

  return {
    cardRegionRef,
    menuRef,
    playExit,
    transitioning,
  };
}
