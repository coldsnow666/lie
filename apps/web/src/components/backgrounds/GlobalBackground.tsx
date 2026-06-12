/**
 * @Description: 全站动态背景：使用 Faulty Terminal 作为黑底终端噪声背景。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const FaultyTerminal = dynamic(() => import("@/components/backgrounds/FaultyTerminal"), {
  ssr: false,
});

const oceanTheme = {
  tint: "#71b8ff",
};

const lobbyTheme = {
  tint: "#c9a5ff",
};

const gameTheme = {
  tint: "#a7e79e",
};

export default function GlobalBackground() {
  const pathname = usePathname();
  const [pageVisible, setPageVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const backgroundTheme = pathname?.startsWith("/room") ? gameTheme : pathname?.startsWith("/lobby") ? lobbyTheme : oceanTheme;
  const shaderEnabled = !prefersReducedMotion;

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
    <div className="fixed inset-0 z-0 overflow-hidden bg-black" aria-hidden="true">
      <div className="absolute inset-0">
        {shaderEnabled ? (
          <FaultyTerminal
            className="absolute inset-0"
            brightness={0.8}
            curvature={0.35}
            digitSize={1.2}
            dpr={1}
            flickerAmount={1}
            glitchAmount={1}
            mouseReact={false}
            mouseStrength={0.7}
            noiseAmp={0.8}
            pageLoadAnimation={false}
            paused={!pageVisible}
            scale={1.5}
            scanlineIntensity={0.5}
            timeScale={0.5}
            tint={backgroundTheme.tint}
          />
        ) : null}
      </div>
      <div className="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(0,0,0,0.62),transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.36)_76%,rgba(0,0,0,0.72))]" />
    </div>
  );
}
