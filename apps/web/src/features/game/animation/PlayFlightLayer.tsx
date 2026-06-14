/**
 * @Description: 出牌飞行动画层，负责把已选手牌先翻成背面，再飞向弃牌区。
 *
 * @Date 2026-06-13 00:00
 */
"use client";

import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import { gsap } from "gsap";
import type { Card } from "@lie/shared";
import CardBackArt from "@/components/cards/CardBackArt";
import DomPlayingCard from "@/components/cards/DomPlayingCard";
import { playGameSound } from "@/lib/game-audio";
import { getScatteredDiscardPose } from "../discard/discardLayout";
import type { PlayFlightCard } from "../model/gameTableTypes";

const PLAY_FLIP_SECONDS = 0.28;
const PLAY_FLIGHT_SECONDS = 0.54;
const PLAY_STAGGER_SECONDS = 0.045;

function getPlayFlightControlPoint(card: PlayFlightCard, index: number) {
  const direction = index % 2 === 0 ? -1 : 1;
  const midLeft = card.startLeft + (card.targetLeft - card.startLeft) * 0.48;
  const midTop = card.startTop + (card.targetTop - card.startTop) * 0.38;

  return {
    left: midLeft + direction * (38 + index * 7),
    top: midTop - 86 - index * 8,
  };
}

function getElementRotation(element: HTMLElement) {
  const transform = window.getComputedStyle(element).transform;

  if (!transform || transform === "none") {
    return 0;
  }

  const matrix = new DOMMatrixReadOnly(transform);
  return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
}

export function measurePlayFlightCards(cards: Card[], cardBack: number, discardPileCardCount: number) {
  const discardPile = document.querySelector<HTMLElement>(".lie-discard-pile");
  const discardBounds = discardPile?.getBoundingClientRect();

  if (!discardBounds) {
    return [];
  }

  return cards.flatMap((card, index) => {
    const node = document.querySelector<HTMLElement>(`[data-hand-card-id="${card.id}"]`);

    if (!node) {
      return [];
    }

    const bounds = node.getBoundingClientRect();
    const targetPose = getScatteredDiscardPose(discardPileCardCount + index);

    return [
      {
        id: `play-${card.id}-${Date.now()}-${index}`,
        card,
        cardBack,
        startLeft: bounds.left + bounds.width / 2,
        startTop: bounds.top + bounds.height / 2,
        startWidth: bounds.width,
        startHeight: bounds.height,
        startRotate: getElementRotation(node),
        targetLeft: discardBounds.left + discardBounds.width / 2 + targetPose.x,
        targetTop: discardBounds.top + discardBounds.height * 0.45 + targetPose.y,
        targetWidth: 49 * 1.55,
        targetHeight: 65 * 1.55,
        targetRotate: targetPose.rotate,
        zIndex: 300 + index,
      },
    ];
  });
}

export default function PlayFlightLayer({ cards, onComplete }: { cards: PlayFlightCard[]; onComplete: () => void }) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const completeFrameRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useLayoutEffect(() => {
    if (!cards.length || !layerRef.current) {
      return;
    }

    timelineRef.current?.kill();
    if (completeFrameRef.current !== null) {
      window.cancelAnimationFrame(completeFrameRef.current);
      completeFrameRef.current = null;
    }
    const timeline = gsap.timeline({
      onComplete: () => {
        completeFrameRef.current = window.requestAnimationFrame(() => {
          completeFrameRef.current = null;
          onCompleteRef.current();
        });
      },
    });
    timelineRef.current = timeline;

    cards.forEach((card, index) => {
      const shell = layerRef.current?.querySelector<HTMLElement>(`[data-play-flight-card-id="${card.id}"]`);
      const flip = shell?.querySelector<HTMLElement>(".lie-play-flight-flip");

      if (!shell || !flip) {
        return;
      }

      const control = getPlayFlightControlPoint(card, index);
      const flight = { progress: 0 };
      const startScale = 1;
      const exactTargetScale = card.targetWidth / Math.max(card.startWidth, 1);
      const travelScale = Math.max(0.92, Math.min(1.12, exactTargetScale));
      const startAt = index * PLAY_STAGGER_SECONDS;

      gsap.set(shell, {
        left: card.startLeft,
        top: card.startTop,
        width: card.startWidth,
        height: card.startHeight,
        rotate: card.startRotate,
        xPercent: -50,
        yPercent: -50,
        opacity: 1,
        scale: startScale,
        zIndex: card.zIndex,
      });
      gsap.set(flip, { rotateY: 0 });

      timeline.to(
        flip,
        {
          rotateY: 180,
          duration: PLAY_FLIP_SECONDS,
          ease: "power2.inOut",
        },
        startAt,
      );

      timeline.to(
        flight,
        {
          progress: 1,
          duration: PLAY_FLIGHT_SECONDS,
          ease: "power2.inOut",
          onStart: () => playGameSound("play"),
          onUpdate: () => {
            const progress = flight.progress;
            const inverse = 1 - progress;
            const lift = Math.sin(progress * Math.PI);
            const left = inverse * inverse * card.startLeft + 2 * inverse * progress * control.left + progress * progress * card.targetLeft;
            const top = inverse * inverse * card.startTop + 2 * inverse * progress * control.top + progress * progress * card.targetTop;
            const settleProgress = progress < 0.76 ? 0 : (progress - 0.76) / 0.24;
            const travelProgress = Math.min(progress / 0.76, 1);
            const scale =
              startScale +
              (travelScale - startScale) * travelProgress +
              (exactTargetScale - travelScale) * settleProgress +
              lift * 0.06 * (1 - settleProgress);
            const rotate = card.startRotate + (card.targetRotate - card.startRotate) * progress + lift * (index % 2 === 0 ? -5 : 5);

            gsap.set(shell, {
              left,
              top,
              rotate,
              scale,
              filter: `drop-shadow(0 ${6 + lift * 10}px ${9 + lift * 10}px rgba(8, 13, 14, ${0.2 + lift * 0.08}))`,
            });
          },
        },
        startAt + PLAY_FLIP_SECONDS * 0.72,
      );
    });

    return () => {
      if (completeFrameRef.current !== null) {
        window.cancelAnimationFrame(completeFrameRef.current);
        completeFrameRef.current = null;
      }
      timeline.kill();
      timelineRef.current = null;
    };
  }, [cards]);

  if (!cards.length) {
    return null;
  }

  return (
    <div ref={layerRef} className="lie-play-flight-layer" aria-hidden>
      {cards.map((card) => (
        <span
          key={card.id}
          data-play-flight-card-id={card.id}
          className="lie-play-flight-shell"
          style={
            {
              "--play-flight-card-scale": card.startWidth / 49,
            } as CSSProperties
          }
        >
          <span className="lie-play-flight-flip">
            <span className="lie-play-flight-face lie-play-flight-front">
              <DomPlayingCard
                card={card.card}
                label="出牌前翻转的手牌"
                className="lie-play-flight-card [--pixel-card-scale:var(--play-flight-card-scale)]"
              />
            </span>
            <span className="lie-play-flight-face lie-play-flight-back">
              <CardBackArt
                back={card.cardBack}
                label="出牌中的牌背"
                className="lie-play-flight-card [--card-back-art-height:65px] [--card-back-art-width:49px] [--card-back-scale:var(--play-flight-card-scale)]"
              />
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}
