/**
 * @Description: 全站背景：按页面和房间状态切换 Balatro 风格动效或静态牌桌底图。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const Balatro = dynamic(() => import("@/components/backgrounds/Balatro"), {
  ssr: false,
});

type BackgroundMode = "default" | "lobby" | "room" | "game";

type BackgroundTheme = {
  color1: string;
  color2: string;
  color3: string;
  spinRotation: number;
  spinSpeed: number;
  contrast: number;
  lighting: number;
  spinAmount: number;
  pixelFilter: number;
  spinEase: number;
  fallbackClassName: string;
  fallbackActiveClassName: string;
  overlayClassName: string;
  animated: boolean;
  shaderEnabled: boolean;
};

const backgroundThemes: Record<BackgroundMode, BackgroundTheme> = {
  default: {
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
    animated: true,
    shaderEnabled: true,
  },
  lobby: {
    color1: "#c9a5ff",
    color2: "#7e45ff",
    color3: "#0b0716",
    spinRotation: -2.25,
    spinSpeed: 6.7,
    contrast: 3.12,
    lighting: 0.36,
    spinAmount: 0.25,
    pixelFilter: 1060,
    spinEase: 1,
    fallbackClassName: "lie-balatro-fallback-violet",
    fallbackActiveClassName: "lie-balatro-fallback-violet-active",
    overlayClassName: "lie-balatro-overlay-violet",
    animated: true,
    shaderEnabled: true,
  },
  room: {
    color1: "#baf7c7",
    color2: "#2fd08f",
    color3: "#0b1812",
    spinRotation: -2.1,
    spinSpeed: 6.5,
    contrast: 3.1,
    lighting: 0.34,
    spinAmount: 0.22,
    pixelFilter: 940,
    spinEase: 0.95,
    fallbackClassName: "lie-balatro-fallback-forest",
    fallbackActiveClassName: "lie-balatro-fallback-forest-active",
    overlayClassName: "lie-balatro-overlay-forest",
    animated: true,
    shaderEnabled: true,
  },
  game: {
    color1: "#baf7c7",
    color2: "#2fd08f",
    color3: "#0b1812",
    spinRotation: -2.1,
    spinSpeed: 0,
    contrast: 3.1,
    lighting: 0.32,
    spinAmount: 0.22,
    pixelFilter: 940,
    spinEase: 0.95,
    fallbackClassName: "lie-balatro-fallback-forest",
    fallbackActiveClassName: "lie-balatro-fallback-forest-active",
    overlayClassName: "lie-balatro-overlay-forest",
    animated: false,
    shaderEnabled: true,
  },
};

function getBackgroundMode(pathname: string | null, bodyMode?: string): BackgroundMode {
  if (bodyMode === "game" || bodyMode === "room") {
    return bodyMode;
  }

  if (pathname?.startsWith("/room/")) {
    return "room";
  }

  return pathname === "/lobby" ? "lobby" : "default";
}

export default function GlobalBackground() {
  const pathname = usePathname();
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>(() => getBackgroundMode(null));
  const [fallbackActive, setFallbackActive] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const backgroundTheme = backgroundThemes[backgroundMode];
  const shaderEnabled = backgroundTheme.shaderEnabled && !prefersReducedMotion;
  const animatedFallback = fallbackActive && backgroundTheme.animated && !prefersReducedMotion;
  const handleWebglReady = useCallback(() => setFallbackActive(false), []);
  const handleWebglFallback = useCallback(() => setFallbackActive(true), []);

  useEffect(() => {
    const syncBackgroundMode = () => {
      setBackgroundMode(getBackgroundMode(pathname, document.body.dataset.lieBackgroundMode));
      setFallbackActive(false);
    };

    syncBackgroundMode();

    const observer = new MutationObserver(syncBackgroundMode);
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-lie-background-mode"] });

    return () => observer.disconnect();
  }, [pathname]);

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
            animated={backgroundTheme.animated}
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
