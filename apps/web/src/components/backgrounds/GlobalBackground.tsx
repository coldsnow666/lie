/**
 * 全站动态背景：统一承载 Ferrofluid 和暗色遮罩，供所有页面共用。
 */
"use client";

import { useCallback, useState } from "react";
import Ferrofluid from "@/components/backgrounds/Ferrofluid";

const backgroundColors = ["#d7bc72", "#2fd08f", "#fff6cf"];

export default function GlobalBackground() {
  const [fallbackActive, setFallbackActive] = useState(false);
  const handleWebglReady = useCallback(() => setFallbackActive(false), []);
  const handleWebglFallback = useCallback(() => setFallbackActive(true), []);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#0b1812]" aria-hidden="true">
      <div className={`lie-fluid-fallback absolute inset-0 ${fallbackActive ? "lie-fluid-fallback-active" : ""}`} />
      <Ferrofluid
        dpr={1.05}
        maxFps={30}
        mouseInteraction={false}
        onFallback={handleWebglFallback}
        onReady={handleWebglReady}
        colors={backgroundColors}
        speed={0.38}
        scale={1.35}
        turbulence={0.85}
        fluidity={0.08}
        rimWidth={0.28}
        sharpness={2.8}
        shimmer={1.2}
        glow={2.6}
        opacity={0.82}
        mouseRadius={0.42}
        mouseStrength={0.85}
        mixBlendMode="screen"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(215,188,114,0.16),transparent_28%),linear-gradient(180deg,rgba(5,10,8,0.25),rgba(5,10,8,0.88))]" />
      <div className="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(0,0,0,0.65),transparent)]" />
    </div>
  );
}
