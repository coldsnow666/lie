/**
 * @Description: 牌桌飞牌动画的 DOM 测量、贝塞尔插值和接收区域反馈工具。
 *
 * @Date 2026-06-12 14:47
 */
import { gsap } from "gsap";
import type { Card } from "@lie/shared";
import type { DealFlightTargetPose } from "./gameTableTypes";

export function getDealFlightArc(orderIndex: number, selfCard?: Card) {
  const direction = orderIndex % 2 === 0 ? -1 : 1;
  const lane = orderIndex % 4;

  return {
    midX: direction * (24 + lane * 7),
    midY: -42 - (orderIndex % 3) * 8 + (selfCard ? 14 : 0),
    overshootX: direction * (7 + (orderIndex % 2) * 3),
    overshootY: (selfCard ? 8 : -7) + (orderIndex % 3) * 2,
    startRotate: direction * (10 + lane * 2.8),
    settleRotate: direction * (selfCard ? 4.8 : 3.4),
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

export function getDealFlightTargetPose(targetNode: HTMLElement | null, shell: HTMLElement, layer: HTMLElement): DealFlightTargetPose {
  if (!targetNode) {
    return {
      x: 0,
      y: 0,
      rotate: 0,
      scale: 0.96,
      visible: false,
    };
  }

  const layerBounds = layer.getBoundingClientRect();
  const originX = layerBounds.left + layerBounds.width / 2;
  const originY = layerBounds.top + layerBounds.height * 0.55;
  const targetBounds = targetNode.getBoundingClientRect();
  const shellBounds = shell.getBoundingClientRect();

  return {
    x: targetBounds.left + targetBounds.width / 2 - originX,
    y: targetBounds.top + targetBounds.height / 2 - originY,
    rotate: getElementRotation(targetNode),
    scale: Math.max(0.62, Math.min(1.7, targetBounds.width / Math.max(shellBounds.width, 1))),
    visible: true,
  };
}

function lerpNumber(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function smoothProgress(progress: number) {
  return progress * progress * (3 - 2 * progress);
}

function getCubicBezierPoint(start: number, controlA: number, controlB: number, end: number, progress: number) {
  const inverse = 1 - progress;

  return inverse * inverse * inverse * start + 3 * inverse * inverse * progress * controlA + 3 * inverse * progress * progress * controlB + progress * progress * progress * end;
}

export function applyCardFlightFrame({
  arc,
  lockTargetScale = false,
  fadeIn = true,
  progress,
  shell,
  startRotate,
  startX,
  startY,
  targetPose,
}: {
  arc: ReturnType<typeof getDealFlightArc>;
  fadeIn?: boolean;
  lockTargetScale?: boolean;
  progress: number;
  shell: HTMLElement;
  startRotate: number;
  startX: number;
  startY: number;
  targetPose: DealFlightTargetPose;
}) {
  const easedProgress = smoothProgress(progress);
  const liftProgress = Math.sin(Math.PI * progress);
  const wobble = Math.sin(progress * Math.PI * 3.2) * (1 - progress);
  const controlAX = lerpNumber(startX, targetPose.x, 0.34) + arc.midX;
  const controlAY = lerpNumber(startY, targetPose.y, 0.22) + arc.midY - 12;
  const controlBX = targetPose.x + arc.overshootX * 1.85;
  const controlBY = targetPose.y + arc.overshootY * 1.85;
  const x = getCubicBezierPoint(startX, controlAX, controlBX, targetPose.x, easedProgress);
  const y = getCubicBezierPoint(startY, controlAY, controlBY, targetPose.y, easedProgress);
  const opacityIn = fadeIn ? Math.min(1, progress / 0.14) : 1;
  const opacityOut = targetPose.visible ? 1 : 1 - easedProgress;
  const shadowLift = 3 + liftProgress * 8;

  gsap.set(shell, {
    xPercent: -50,
    yPercent: -50,
    x,
    y,
    rotate: lerpNumber(startRotate, targetPose.rotate, easedProgress) + liftProgress * arc.settleRotate * 0.45 + wobble * 5.4,
    scale: lockTargetScale ? 1 : lerpNumber(1, targetPose.scale, easedProgress) + liftProgress * 0.08 + wobble * 0.018,
    opacity: opacityIn * opacityOut,
    filter: `drop-shadow(0 ${shadowLift}px ${shadowLift + 2}px rgba(8, 13, 14, ${0.18 + liftProgress * 0.08}))`,
  });
}

export function pulseCardReceiver(targetNode: HTMLElement | null) {
  const receiver = targetNode?.closest<HTMLElement>(".lie-opponent-card-stack, .lie-game-hand");

  if (!receiver) {
    return;
  }

  receiver.classList.remove("lie-card-receive-bump");
  void receiver.offsetWidth;
  receiver.classList.add("lie-card-receive-bump");
  window.setTimeout(() => receiver.classList.remove("lie-card-receive-bump"), 280);
}

export function syncReturnFlightCardSize(shell: HTMLElement, targetNode: HTMLElement | null) {
  const cardNode = shell.firstElementChild instanceof HTMLElement ? shell.firstElementChild : null;

  if (!cardNode || !targetNode) {
    return;
  }

  const targetBounds = targetNode.getBoundingClientRect();

  cardNode.style.width = `${targetBounds.width}px`;
  cardNode.style.height = `${targetBounds.height}px`;
}
