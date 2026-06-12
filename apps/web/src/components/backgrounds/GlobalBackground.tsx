/**
 * @Description: 全站动态背景：统一承载蓝色 Balatro 风格牌桌旋涡和暗色遮罩，供所有页面共用。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

const Balatro = dynamic(() => import("@/components/backgrounds/Balatro"), {
  ssr: false,
});

const backgroundTheme = {
  color1: "#71b8ff",
  color2: "#2b6fff",
  color3: "#0b1812",
  spinRotation: -2.4,
  spinSpeed: 6.9,
  contrast: 3.18,
  lighting: 0.38,
  spinAmount: 0.26,
  pixelFilter: 1200,
  spinEase: 1.02,
  fallbackClassName: "lie-balatro-fallback-ocean",
  fallbackActiveClassName: "lie-balatro-fallback-ocean-active",
  overlayClassName: "lie-balatro-overlay-ocean",
};

export default function GlobalBackground() {
  const [fallbackActive, setFallbackActive] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const shaderEnabled = !prefersReducedMotion;
  const animatedFallback = fallbackActive && !prefersReducedMotion;
  const handleWebglReady = useCallback(() => setFallbackActive(false), []);
  const handleWebglFallback = useCallback(() => setFallbackActive(true), []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncReducedMotion = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };
    const syncPageVisibility = () => {
      setPageVisible(document.visibilityState === "visible");
    };

    syncReducedMotion();
    syncPageVisibility();

    mediaQuery.addEventListener("change", syncReducedMotion);
    document.addEventListener("visibilitychange", syncPageVisibility);

    return () => {
      mediaQuery.removeEventListener("change", syncReducedMotion);
      document.removeEventListener("visibilitychange", syncPageVisibility);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#0b1812]" aria-hidden="true">
      <div className="absolute inset-0">
        <div
          className={[
            "absolute inset-0",
            backgroundTheme.fallbackClassName,
            animatedFallback ? backgroundTheme.fallbackActiveClassName : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
        {shaderEnabled ? (
          <Balatro
            dpr={1.05}
            maxFps={30}
            mouseInteraction={false}
            onFallback={handleWebglFallback}
            onReady={handleWebglReady}
            color1={backgroundTheme.color1}
            color2={backgroundTheme.color2}
            color3={backgroundTheme.color3}
            spinRotation={backgroundTheme.spinRotation}
            spinSpeed={backgroundTheme.spinSpeed}
            contrast={backgroundTheme.contrast}
            lighting={backgroundTheme.lighting}
            spinAmount={backgroundTheme.spinAmount}
            pixelFilter={backgroundTheme.pixelFilter}
            spinEase={backgroundTheme.spinEase}
            isRotate={false}
            paused={!pageVisible}
          />
        ) : null}
        <div className={`absolute inset-0 ${backgroundTheme.overlayClassName}`} />
      </div>
      <div className="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(0,0,0,0.62),transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,4,8,0.08),rgba(3,5,10,0.18)_38%,rgba(2,3,6,0.52))]" />
    </div>
  );
}
