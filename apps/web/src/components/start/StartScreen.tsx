/**
 * 传统游戏启动页：展示游戏名、进入游戏、注册和基础设置入口。
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BounceCards from "@/components/start/BounceCards";
import { useStartScreenTransition } from "@/components/start/useStartScreenTransition";
import { clearSession, isLoggedIn } from "@/lib/auth";

export default function StartScreen() {
  const router = useRouter();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [favorited, setFavorited] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const { cardRegionRef, menuRef, playExit, transitioning } = useStartScreenTransition();

  useEffect(() => {
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    const bodyHeight = document.body.style.height;

    const loginStateTimer = window.setTimeout(() => setLoggedIn(isLoggedIn()), 0);

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.height = "100dvh";

    return () => {
      window.clearTimeout(loginStateTimer);
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
      document.body.style.height = bodyHeight;
    };
  }, []);

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
              <BounceCards playIntro={false} />
            </div>
          </div>

          <div ref={menuRef} data-start-menu className="mb-[clamp(0.35rem,2vh,0.85rem)] grid w-full max-w-[min(31rem,100%)] shrink-0 grid-cols-[1.42fr_1fr_1fr_1fr] gap-[clamp(0.28rem,1.2vw,0.5rem)] rounded bg-[#17372b]/85 p-[clamp(0.28rem,1.2vw,0.38rem)] shadow-2xl shadow-black/45 ring-1 ring-[#f0d98d]/25">
            <button
              type="button"
              onClick={enterGame}
              disabled={transitioning}
              className="h-[clamp(2.35rem,7.4vh,3rem)] rounded bg-[#208de8] px-1 text-sm font-black text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.22),0_2px_7px_rgba(0,0,0,0.35)] transition hover:bg-[#33a7ff] sm:text-lg"
            >
              {loggedIn ? "进入游戏" : "登录"}
            </button>
            <button
              type="button"
              title={soundEnabled ? "关闭音效" : "开启音效"}
              onClick={() => setSoundEnabled((value) => !value)}
              disabled={transitioning}
              className="h-[clamp(2.35rem,7.4vh,3rem)] rounded bg-[#f39a22] px-1 text-xs font-black text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.2),0_2px_7px_rgba(0,0,0,0.3)] transition hover:bg-[#ffad33] sm:text-base"
            >
              选项
            </button>
            <button
              type="button"
              onClick={logoutFromStart}
              disabled={transitioning}
              className="h-[clamp(2.35rem,7.4vh,3rem)] rounded bg-[#f04b3f] px-1 text-xs font-black text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.2),0_2px_7px_rgba(0,0,0,0.3)] transition hover:bg-[#ff6154] sm:text-base"
            >
              退出
            </button>
            <button
              type="button"
              onClick={() => setFavorited((value) => !value)}
              disabled={transitioning}
              className="h-[clamp(2.35rem,7.4vh,3rem)] rounded bg-[#62b79b] px-1 text-xs font-black text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.2),0_2px_7px_rgba(0,0,0,0.3)] transition hover:bg-[#75caaa] sm:text-base"
            >
              {favorited ? "已藏" : "收藏"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
