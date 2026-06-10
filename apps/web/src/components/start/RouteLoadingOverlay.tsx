/**
 * 文件说明：启动页进入大厅时展示的牌面切换 Loading 覆盖层。
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { createDeck } from "@lie/shared";
import CardBackArt from "@/components/game/CardBackArt";
import DomPlayingCard from "@/components/game/DomPlayingCard";

const deck = createDeck();

type RouteLoadingOverlayProps = {
  phase: "opening" | "waiting" | "closing";
  transitionDuration: number;
};

function randomIndex(length: number) {
  return Math.floor(Math.random() * length);
}

const DIAMOND_END_SCALE = 1.18;
const DIAMOND_START_SIZE_RATIO = 2.2;
const DIAMOND_CLOSED_SCALE = 0;
const CARD_SPIN_DURATION = 900;
const CARD_FADE_START = 0;
const CARD_FADE_END = 0.62;
const CARD_TILT_X = 8;
const CARD_TILT_Z = -3;
const DIAMOND_ROTATION = -10;

function easeInOutCubic(progress: number) {
  if (progress < 0.5) {
    return 4 * progress * progress * progress;
  }

  return 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function clampProgress(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function getDiamondCardScale(diamond: HTMLDivElement, cardStage: HTMLDivElement) {
  const diamondSize = diamond.offsetWidth || Math.max(window.innerWidth, window.innerHeight);
  const cardBounds = cardStage.getBoundingClientRect();
  const cardSize = Math.max(cardBounds.width, cardBounds.height);

  return (cardSize * DIAMOND_START_SIZE_RATIO) / (diamondSize * Math.SQRT2);
}

export default function RouteLoadingOverlay({ phase, transitionDuration }: RouteLoadingOverlayProps) {
  const [faceCard] = useState(() => deck[randomIndex(deck.length)] ?? deck[0]);
  const [backIndex] = useState(() => randomIndex(4));
  const diamondRef = useRef<HTMLDivElement>(null);
  const cardStageRef = useRef<HTMLDivElement>(null);
  const cardSpinRef = useRef<HTMLDivElement>(null);
  const spinStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    let frameId = 0;
    const phaseStartedAt = window.performance.now();

    spinStartedAtRef.current ??= phaseStartedAt;

    const renderFrame = (now: number) => {
      const diamond = diamondRef.current;
      const cardStage = cardStageRef.current;
      const cardSpin = cardSpinRef.current;

      if (!diamond || !cardStage || !cardSpin) {
        return;
      }

      const rawProgress = clampProgress((now - phaseStartedAt) / transitionDuration);
      const easedProgress = easeInOutCubic(rawProgress);
      const spinElapsed = now - (spinStartedAtRef.current ?? now);
      const spinDegrees = (spinElapsed / CARD_SPIN_DURATION) * 360;
      const diamondStartScale = getDiamondCardScale(diamond, cardStage);
      let diamondScale = DIAMOND_END_SCALE;
      let cardOpacity = 1;

      if (phase === "opening") {
        diamondScale = lerp(diamondStartScale, DIAMOND_END_SCALE, easedProgress);
        cardOpacity = clampProgress(rawProgress / 0.16);
      }

      if (phase === "closing") {
        diamondScale = lerp(DIAMOND_END_SCALE, DIAMOND_CLOSED_SCALE, easedProgress);
        cardOpacity = 1 - clampProgress((rawProgress - CARD_FADE_START) / (CARD_FADE_END - CARD_FADE_START));
      }

      diamond.style.opacity = "1";
      diamond.style.transform = `translate3d(-50%, -50%, 0) rotate(${DIAMOND_ROTATION}deg) scale(${diamondScale})`;
      cardStage.style.opacity = String(cardOpacity);
      cardStage.style.transform = "translate3d(-50%, -50%, 0) scale(1) rotate(0deg)";
      cardSpin.style.transform = `rotateX(${CARD_TILT_X}deg) rotateY(${spinDegrees}deg) rotateZ(${CARD_TILT_Z}deg) scale(1)`;

      frameId = window.requestAnimationFrame(renderFrame);
    };

    frameId = window.requestAnimationFrame(renderFrame);

    return () => window.cancelAnimationFrame(frameId);
  }, [phase, transitionDuration]);

  return (
    <div
      aria-label="进入大厅中"
      aria-live="polite"
      data-loading-phase={phase}
      className="lie-route-loading-overlay fixed inset-0 z-[80] grid place-items-center overflow-hidden"
    >
      <div ref={diamondRef} aria-hidden className="lie-route-loading-diamond" />
      <div ref={cardStageRef} className="lie-route-loading-card-stage">
        <div ref={cardSpinRef} className="lie-route-loading-card-spin">
          <div className="lie-route-loading-card-side lie-route-loading-face">
            <DomPlayingCard card={faceCard} className="[--pixel-card-scale:2.35]" />
          </div>
          <div className="lie-route-loading-card-side lie-route-loading-back">
            <CardBackArt
              back={backIndex}
              label={`随机牌背 ${backIndex + 1}`}
              className="[--card-back-art-height:65px] [--card-back-art-width:49px] [--card-back-scale:2.35]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
