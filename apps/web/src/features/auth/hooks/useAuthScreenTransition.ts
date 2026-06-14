/**
 * @Description: 认证页转场动画：统一处理扑克牌飞散和表单上退，再衔接首页入场。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import { gsap } from "gsap";
import { cornerFlights, resolveViewportCornerFlights } from "@/features/start";

type TransitionTargets = {
  cards: HTMLElement[];
  form: HTMLElement;
};

function resolveTargets(cardRegion: HTMLElement | null, formShell: HTMLElement | null): TransitionTargets | null {
  if (!cardRegion || !formShell) {
    return null;
  }

  const cards = cornerFlights
    .map((flight) => cardRegion.querySelector<HTMLElement>(`[data-bounce-card-flight="${flight.rank}"]`))
    .filter((card): card is HTMLElement => Boolean(card));

  if (cards.length !== cornerFlights.length) {
    return null;
  }

  return { cards, form: formShell };
}

function prepareCompositedMotion(targets: TransitionTargets) {
  // 认证页退场只改 transform 和 opacity，避免表单和卡片同步运动时抖动。
  gsap.set([...targets.cards, targets.form], {
    force3D: true,
    willChange: "transform, opacity",
  });
}

function resetTargets(targets: TransitionTargets) {
  gsap.set(targets.cards, {
    x: 0,
    y: 0,
    rotate: 0,
    scale: 1,
    opacity: 1,
  });
  gsap.set(targets.form, {
    y: 0,
    scale: 1,
    opacity: 1,
  });
}

/**
 * @Description: 管理认证页退场时间线，确保卡牌飞散和表单上退在同一帧序列里完成。
 *
 * @return 牌区和表单 ref、退出播放方法以及转场状态。
 *
 * @Date 2026-06-12 14:47
 */
export function useAuthScreenTransition(): {
  cardRegionRef: RefObject<HTMLDivElement | null>;
  formShellRef: RefObject<HTMLDivElement | null>;
  playExit: (onComplete: () => void) => void;
  transitioning: boolean;
} {
  const cardRegionRef = useRef<HTMLDivElement | null>(null);
  const formShellRef = useRef<HTMLDivElement | null>(null);
  const activeTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const transitioningRef = useRef(false);
  const [transitioning, setTransitioning] = useState(false);

  const createTimeline = useCallback((onComplete?: () => void) => {
    const targets = resolveTargets(cardRegionRef.current, formShellRef.current);

    if (!targets) {
      return null;
    }

    resetTargets(targets);
    prepareCompositedMotion(targets);
    const exitFlights = resolveViewportCornerFlights(targets.cards).map((flight) => ({
      ...flight,
      x: typeof flight.x === "number" ? flight.x : 0,
      y: typeof flight.y === "number" ? flight.y : 0,
    }));

    return gsap
      .timeline({
        paused: true,
        defaults: { overwrite: "auto" },
        onComplete,
      })
      .to(
        targets.cards,
        {
          x: (index) => exitFlights[index]?.x ?? 0,
          y: (index) => exitFlights[index]?.y ?? 0,
          rotate: (index) => exitFlights[index]?.rotate ?? 0,
          scale: 0.92,
          opacity: 0,
          duration: 0.68,
          ease: "power3.in",
          stagger: 0.032,
        },
        0,
      )
      .to(
        targets.form,
        {
          y: "-18vh",
          scale: 0.98,
          opacity: 0,
          duration: 0.46,
          ease: "power3.in",
        },
        0.04,
      );
  }, []);

  const playExit = useCallback(
    (onComplete: () => void) => {
      if (transitioningRef.current) {
        return;
      }

      const timeline = createTimeline(() => {
        transitioningRef.current = false;
        setTransitioning(false);
        onComplete();
      });

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
    formShellRef,
    playExit,
    transitioning,
  };
}
