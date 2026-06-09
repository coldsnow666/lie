/**
 * 传统游戏启动页：展示游戏名、进入游戏、注册和基础设置入口。
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BounceCards from "@/components/start/BounceCards";
import { useStartScreenTransition } from "@/components/start/useStartScreenTransition";
import PixelButton from "@/components/ui/PixelButton";
import PixelPanel from "@/components/ui/PixelPanel";
import { clearSession, isLoggedIn } from "@/lib/auth";

export default function StartScreen() {
  const router = useRouter();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const { cardRegionRef, menuRef, playExit, replayIntro, transitioning } = useStartScreenTransition();

  useEffect(() => {
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    const bodyHeight = document.body.style.height;

    const loginStateTimer = window.setTimeout(() => setLoggedIn(isLoggedIn()), 0);

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.height = "100dvh";

    const syncLoginState = () => {
      setLoggedIn(isLoggedIn());
    };

    const handlePageShow = () => {
      syncLoginState();
      // 浏览器返回命中 bfcache 时，页面会复用上次退出后的 DOM 状态，这里强制重播入场动画。
      window.setTimeout(() => replayIntro(), 0);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncLoginState();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(loginStateTimer);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
      document.body.style.height = bodyHeight;
    };
  }, [replayIntro]);

  function enterGame() {
    if (transitioning) {
      return;
    }

    // 退出启动页时先播放四张牌飞散和按钮下退，再执行真实路由跳转。
    playExit(() => router.push(loggedIn ? "/lobby" : "/login"));
  }

  function logoutFromStart() {
    // 启动页退出只清理本地登录态，让菜单立即回到未登录状态，不跳转登录页。
    clearSession();
    setLoggedIn(false);
  }

  return (
    <main className="relative h-dvh max-h-dvh overflow-hidden text-[#f7f0dc]">
      <div className="relative mx-auto flex h-full min-h-0 max-w-5xl flex-col px-[clamp(0.75rem,3vw,1.25rem)] py-[clamp(0.55rem,2vh,1.1rem)]">
        <section className="flex min-h-0 flex-1 flex-col items-center text-center">
          <div className="flex min-h-0 w-full flex-1 items-center justify-center pb-[clamp(0.75rem,3vh,1.5rem)]">
            <div ref={cardRegionRef} data-start-card-region className="relative h-[clamp(10rem,43dvh,21rem)] w-full max-w-[min(35rem,100%)] shrink-0 overflow-visible">
              <BounceCards playIntro={false} managedShellMotion />
            </div>
          </div>

          <PixelPanel
            ref={menuRef}
            data-start-menu
            tone="forest"
            padding="sm"
            className="mb-[clamp(0.35rem,2vh,0.85rem)] flex w-full max-w-[min(18rem,100%)] shrink-0 flex-col items-center gap-[clamp(0.28rem,1.2vw,0.5rem)] shadow-2xl shadow-black/45"
          >
            <PixelButton
              onClick={enterGame}
              disabled={transitioning}
              variant="accent"
              fullWidth
              className="h-[clamp(2.35rem,7.4vh,3rem)] px-1 text-sm sm:text-lg"
            >
              {loggedIn ? "进入大厅" : "登录"}
            </PixelButton>
            <PixelButton
              title={soundEnabled ? "关闭音效" : "开启音效"}
              onClick={() => setSoundEnabled((value) => !value)}
              disabled={transitioning}
              variant="primary"
              fullWidth
              className="h-[clamp(2.35rem,7.4vh,3rem)] px-1 text-xs sm:text-base"
            >
              设置
            </PixelButton>
            {loggedIn ? (
              <PixelButton
                onClick={logoutFromStart}
                disabled={transitioning}
                variant="danger"
                fullWidth
                className="h-[clamp(2.35rem,7.4vh,3rem)] px-1 text-xs sm:text-base"
              >
                退出登录
              </PixelButton>
            ) : null}
          </PixelPanel>
        </section>
      </div>
    </main>
  );
}
