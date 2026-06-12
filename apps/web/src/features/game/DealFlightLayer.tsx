/**
 * @Description: 首轮发牌飞行动画层，按 DOM 目标位置把牌库中的牌飞到座位或手牌。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import { gsap } from "gsap";
import CardBackArt from "@/components/cards/CardBackArt";
import DomPlayingCard from "@/components/cards/DomPlayingCard";
import { DEAL_CARD_FLIGHT_SECONDS, DEAL_CARD_STAGGER_SECONDS } from "./gameTableConstants";
import { getDealFlightArc, getDealFlightTargetPose, pulseCardReceiver } from "./gameAnimation";
import type { DealFlightCard } from "./gameTableTypes";

export default function DealFlightLayer({
  flights,
  onFlightComplete,
  remainingDeckCount,
}: {
  flights: DealFlightCard[];
  onFlightComplete: (flight: DealFlightCard) => void;
  remainingDeckCount: number;
}) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const startedFlightIdsRef = useRef(new Set<string>());
  const completedFlightIdsRef = useRef(new Set<string>());
  const flightTimelinesRef = useRef(new Map<string, gsap.core.Timeline>());
  const onFlightCompleteRef = useRef(onFlightComplete);

  useEffect(() => {
    onFlightCompleteRef.current = onFlightComplete;
  }, [onFlightComplete]);

  useLayoutEffect(() => {
    const startedFlightIds = startedFlightIdsRef.current;
    const completedFlightIds = completedFlightIdsRef.current;
    const flightTimelines = flightTimelinesRef.current;

    if (!flights.length || !layerRef.current) {
      if (!flights.length) {
        startedFlightIds.clear();
        completedFlightIds.clear();
      }

      return;
    }

    flights.forEach((flight) => {
      const shell = layerRef.current?.querySelector<HTMLElement>(`[data-deal-flight-card-id="${flight.id}"]`);

      if (!shell || !layerRef.current || startedFlightIds.has(flight.id) || completedFlightIds.has(flight.id)) {
        return;
      }

      startedFlightIds.add(flight.id);
      const targetSelector = flight.selfCard ? `[data-deal-target="self:${flight.targetIndex}"]` : `[data-deal-target="${flight.playerId}:${flight.targetIndex}"]`;
      const targetNode = document.querySelector<HTMLElement>(targetSelector);
      const targetPose = getDealFlightTargetPose(targetNode ?? null, shell, layerRef.current);
      const arc = getDealFlightArc(flight.orderIndex, flight.selfCard);
      const timeline = gsap.timeline();
      const startDelay = flight.orderIndex * DEAL_CARD_STAGGER_SECONDS;
      const controlX = targetPose.x * 0.46 + arc.midX;
      const controlY = targetPose.y * 0.42 + arc.midY;

      flightTimelines.set(flight.id, timeline);

      gsap.set(shell, {
        xPercent: -50,
        yPercent: -50,
        x: 0,
        y: 0,
        rotate: arc.startRotate,
        scale: 1.04,
        opacity: 0,
        filter: "drop-shadow(0 8px 10px rgba(8, 13, 14, 0.24))",
      });

      timeline.to(
        shell,
        {
          x: controlX,
          y: controlY,
          rotate: targetPose.rotate + arc.settleRotate,
          scale: 1.14,
          opacity: 1,
          filter: "drop-shadow(0 12px 14px rgba(8, 13, 14, 0.28))",
          duration: DEAL_CARD_FLIGHT_SECONDS * 0.42,
          ease: "power2.out",
        },
        startDelay,
      );

      timeline.to(
        shell,
        {
          x: targetPose.x + arc.overshootX,
          y: targetPose.y + arc.overshootY,
          rotate: targetPose.rotate - arc.settleRotate * 0.35,
          scale: targetPose.scale * 1.02,
          opacity: targetPose.visible ? 1 : 0,
          filter: "drop-shadow(0 5px 6px rgba(8, 13, 14, 0.22))",
          duration: DEAL_CARD_FLIGHT_SECONDS * 0.4,
          ease: "power2.inOut",
        },
        startDelay + DEAL_CARD_FLIGHT_SECONDS * 0.42,
      );

      timeline.to(
        shell,
        {
          x: targetPose.x,
          y: targetPose.y,
          rotate: targetPose.rotate,
          scale: targetPose.scale,
          opacity: targetPose.visible ? 1 : 0,
          filter: "drop-shadow(0 3px 4px rgba(8, 13, 14, 0.2))",
          duration: DEAL_CARD_FLIGHT_SECONDS * 0.18,
          ease: "back.out(1.7)",
          onComplete: () => {
            if (completedFlightIds.has(flight.id)) {
              return;
            }

            completedFlightIds.add(flight.id);
            flightTimelines.delete(flight.id);
            gsap.set(shell, { opacity: 0 });
            pulseCardReceiver(targetNode);
            onFlightCompleteRef.current(flight);
          },
        },
        startDelay + DEAL_CARD_FLIGHT_SECONDS * 0.82,
      );
    });

    return () => {
      flightTimelines.forEach((timeline) => timeline.kill());
      flightTimelines.clear();
      startedFlightIds.clear();
      completedFlightIds.clear();
    };
  }, [flights]);

  if (!flights.length) {
    return null;
  }

  return (
    <div ref={layerRef} className="lie-deal-flight-layer" aria-hidden>
      <div className="lie-deal-deck">
        {Array.from({ length: Math.min(7, remainingDeckCount) }).map((_, index) => (
          <CardBackArt
            key={`deal-deck-${index}`}
            back={flights[0]?.cardBack ?? 0}
            label="发牌区牌库"
            className="lie-deal-deck-card [--card-back-art-height:65px] [--card-back-art-width:49px] [--card-back-scale:1.55]"
            style={
              {
                "--deal-deck-card-x": `${index * 0.9}px`,
                "--deal-deck-card-y": `${index * -0.5}px`,
                "--deal-deck-card-rotate": `${-3 + index * 0.7}deg`,
                zIndex: index,
              } as CSSProperties
            }
          />
        ))}
        <span className="lie-deal-deck-count">{remainingDeckCount}</span>
      </div>
      {flights.map((flight) => (
        <span
          key={flight.id}
          data-deal-flight-card-id={flight.id}
          className="lie-deal-flight-card"
          style={{ zIndex: flights.length + flight.orderIndex } as CSSProperties}
        >
          {flight.selfCard ? (
            <DomPlayingCard
              card={flight.selfCard}
              label="发到你手中的牌"
              className="lie-deal-flight-side [--pixel-card-scale:1.55]"
            />
          ) : (
            <CardBackArt
              back={flight.cardBack}
              label="发牌中的牌背"
              className="lie-deal-flight-side [--card-back-art-height:65px] [--card-back-art-width:49px] [--card-back-scale:1.55]"
            />
          )}
        </span>
      ))}
    </div>
  );
}
