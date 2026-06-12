/**
 * @Description: 启动页转场动画：封装扑克牌四角飞散、按钮下退和反向入场。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { gsap } from "gsap";
import { cornerFlights } from "../cardScene";

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

function resetTargets(targets: TransitionTargets) {
  // 浏览器返回命中缓存时，DOM 可能停留在退出动画结束态，这里先强制复位到启动页静止态。
  gsap.set(targets.cards, {
    x: 0,
    y: 0,
    rotate: 0,
    scale: 1,
    opacity: 1,
  });
  gsap.set(targets.menu, {
    y: 0,
    opacity: 1,
  });
}

/**
 * @Description: 管理启动页进入和退出时间线，复用同一条动画反向播放作为入场。
 *
 * @return 牌区和菜单 ref、退出播放方法、入场重播方法以及转场状态。
 *
 * @Date 2026-06-12 14:47
 */
export function useStartScreenTransition(): {
  cardRegionRef: RefObject<HTMLDivElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
  playExit: (onComplete: () => void) => void;
  replayIntro: () => void;
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

    resetTargets(targets);
    prepareCompositedMotion(targets);
    const timeline = gsap.timeline({
      paused: true,
      defaults: { overwrite: "auto" },
      onComplete,
    });

    targets.cards.forEach((card, index) => {
      timeline.to(
        card,
        {
          x: cornerFlights[index]?.x ?? "0",
          y: cornerFlights[index]?.y ?? "-52vh",
          rotate: cornerFlights[index]?.rotate ?? 0,
          scale: 0.92,
          opacity: 0,
          duration: 0.68,
          ease: "power3.in",
        },
        index * 0.032,
      );
    });

    timeline.to(
      targets.menu,
      {
        y: "18vh",
        opacity: 0,
        duration: 0.28,
        ease: "power2.in",
      },
      0.68 + (targets.cards.length - 1) * 0.032 - 0.12,
    );

    return timeline;
  }, []);

  const playIntroMotion = useCallback(() => {
    const timeline = createTimeline();

    if (!timeline) {
      return;
    }

    activeTimelineRef.current?.kill();
    activeTimelineRef.current = timeline;
    // 进入启动页时从退出终点反向播放，保持进入/退出使用同一套动效。
    timeline.progress(1).reverse();
  }, [createTimeline]);

  const replayIntro = useCallback(() => {
    transitioningRef.current = false;
    setTransitioning(false);
    playIntroMotion();
  }, [playIntroMotion]);

  useLayoutEffect(() => {
    playIntroMotion();

    return () => {
      activeTimelineRef.current?.kill();
      if (activeTimelineRef.current) {
        activeTimelineRef.current = null;
      }
    };
  }, [playIntroMotion]);

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
    replayIntro,
    transitioning,
  };
}
