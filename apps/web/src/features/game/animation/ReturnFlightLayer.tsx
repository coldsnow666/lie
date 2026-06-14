/**
 * @Description: 质疑结算时弃牌堆飞回失败方的回收动画层。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import { gsap } from "gsap";
import CardBackArt from "@/components/cards/CardBackArt";
import DomPlayingCard from "@/components/cards/DomPlayingCard";
import { playGameSound } from "@/lib/game-audio";
import { DISCARD_RETURN_FLIGHT_SECONDS, DISCARD_RETURN_STAGGER_SECONDS } from "../model/gameTableConstants";
import {
  applyCardFlightFrame,
  getDealFlightArc,
  getDealFlightTargetPose,
  syncReturnFlightCardSize,
} from "./gameAnimation";
import type { ReturnFlightCard } from "../model/gameTableTypes";

export default function ReturnFlightLayer({ cards, onCardComplete }: { cards: ReturnFlightCard[]; onCardComplete: (cardId: string) => void }) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const startedCardIdsRef = useRef(new Set<string>());
  const completedCardIdsRef = useRef(new Set<string>());
  const onCardCompleteRef = useRef(onCardComplete);

  useEffect(() => {
    onCardCompleteRef.current = onCardComplete;
  }, [onCardComplete]);

  useLayoutEffect(() => {
    if (!layerRef.current) {
      return;
    }

    if (!cards.length) {
      startedCardIdsRef.current.clear();
      completedCardIdsRef.current.clear();
      tlRef.current?.kill();
      tlRef.current = null;
      return;
    }

    if (!tlRef.current) {
      tlRef.current = gsap.timeline();
    }

    cards.forEach((card, index) => {
      if (startedCardIdsRef.current.has(card.id) || completedCardIdsRef.current.has(card.id)) {
        return;
      }

      const shell = layerRef.current?.querySelector<HTMLElement>(`[data-return-flight-card-id="${card.id}"]`);

      if (!shell || !layerRef.current) {
        return;
      }

      startedCardIdsRef.current.add(card.id);
      const targetSelector = card.targetSelf ? `[data-return-target="self:${card.targetIndex}"]` : `[data-return-target="${card.playerId}:${card.targetIndex}"]`;
      const targetNode = document.querySelector<HTMLElement>(targetSelector);
      syncReturnFlightCardSize(shell, targetNode);
      const targetPose = getDealFlightTargetPose(targetNode, shell, layerRef.current);
      const arc = getDealFlightArc(index, card.targetSelf ? card.revealCard : undefined);
      const flightState = { progress: 0 };

      gsap.set(shell, {
        xPercent: -50,
        yPercent: -50,
        x: card.startX,
        y: card.startY,
        rotate: card.startRotate,
        opacity: 1,
        scale: 1,
      });

      tlRef.current?.to(
        flightState,
        {
          progress: 1,
          duration: DISCARD_RETURN_FLIGHT_SECONDS,
          ease: "none",
          onStart: () => playGameSound("return"),
          onUpdate: () => {
            applyCardFlightFrame({
              arc,
              disableLiftScale: true,
              fadeIn: false,
              lockTargetScale: true,
              progress: flightState.progress,
              shell,
              startRotate: card.startRotate,
              startX: card.startX,
              startY: card.startY,
              targetPose,
            });
          },
          onComplete: () => {
            if (completedCardIdsRef.current.has(card.id)) {
              return;
            }

            completedCardIdsRef.current.add(card.id);
            gsap.to(shell, {
              opacity: 0,
              scale: 1,
              duration: 0.06,
              ease: "power1.out",
              onComplete: () => onCardCompleteRef.current(card.id),
            });
          },
        },
        index * DISCARD_RETURN_STAGGER_SECONDS,
      );
    });
  }, [cards]);

  useEffect(() => {
    return () => {
      tlRef.current?.kill();
      tlRef.current = null;
    };
  }, []);

  return (
    <div ref={layerRef} className="lie-return-flight-layer" aria-hidden>
      {cards.map((card) => (
        <div
          key={card.id}
          data-return-flight-card-id={card.id}
          className="lie-return-flight-shell"
          style={
            {
              zIndex: card.zIndex,
            } as CSSProperties
          }
        >
          {card.revealCard ? (
            <DomPlayingCard
              card={card.revealCard}
              label="飞回手牌的真实牌"
              className="lie-return-flight-card [--pixel-card-scale:1.55]"
            />
          ) : (
            <CardBackArt
              back={card.cardBack}
              label="飞回手牌的牌背"
              className="lie-return-flight-card [--card-back-art-height:65px] [--card-back-art-width:49px] [--card-back-scale:1.55]"
            />
          )}
        </div>
      ))}
    </div>
  );
}
