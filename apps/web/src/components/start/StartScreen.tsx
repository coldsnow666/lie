/**
 * 传统游戏启动页：展示游戏名、进入游戏、注册和基础设置入口。
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import BounceCards from "@/components/start/BounceCards";
import { useStartScreenTransition } from "@/components/start/useStartScreenTransition";
import { useRouteLoading } from "@/components/loading/RouteLoadingProvider";
import PixelButton from "@/components/ui/PixelButton";
import PixelModal from "@/components/ui/PixelModal";
import PixelPanel from "@/components/ui/PixelPanel";
import { clearSession } from "@/lib/auth";

const LOBBY_ROUTE_PUSH_DELAY = 900;

export default function StartScreen() {
  const router = useRouter();
  const routeLoading = useRouteLoading();
  const { status } = useSession();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [enteringLobby, setEnteringLobby] = useState(false);
  const lobbyRouteTimerRef = useRef<number | null>(null);
  const { cardRegionRef, menuRef, playExit, replayIntro, transitioning } = useStartScreenTransition();
  const loggedIn = status === "authenticated";

  useEffect(() => {
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    const bodyHeight = document.body.style.height;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.height = "100dvh";

    const handlePageShow = () => {
      setEnteringLobby(false);
      routeLoading.cancel();
      // 浏览器返回命中 bfcache 时，页面会复用上次退出后的 DOM 状态，这里强制重播入场动画。
      window.setTimeout(() => replayIntro(), 0);
    };

    window.addEventListener("pageshow", handlePageShow);

    return () => {
      if (lobbyRouteTimerRef.current) {
        window.clearTimeout(lobbyRouteTimerRef.current);
      }
      window.removeEventListener("pageshow", handlePageShow);
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
      document.body.style.height = bodyHeight;
    };
  }, [replayIntro, routeLoading]);

  function enterGame() {
    if (transitioning || enteringLobby) {
      return;
    }

    const targetRoute = loggedIn ? "/lobby" : "/login";

    if (loggedIn) {
      setEnteringLobby(true);
      routeLoading.begin();
      lobbyRouteTimerRef.current = window.setTimeout(() => {
        router.push(targetRoute);
      }, LOBBY_ROUTE_PUSH_DELAY);
      return;
    }

    // 退出启动页时先播放四张牌飞散和按钮下退，再执行真实路由跳转。
    playExit(() => {
      router.push(targetRoute);
    });
  }

  function logoutFromStart() {
    // 启动页退出只清理本地登录态，让菜单立即回到未登录状态，不跳转登录页。
    clearSession();
    setLogoutConfirmOpen(false);
  }

  return (
    <main className="relative h-dvh max-h-dvh overflow-hidden text-[#f7f0dc]">
      <div className="relative mx-auto flex h-full min-h-0 max-w-5xl flex-col px-[clamp(0.75rem,3vw,1.25rem)] py-[clamp(0.55rem,2vh,1.1rem)]">
        <section className="flex min-h-0 flex-1 flex-col items-center text-center">
          <div className="flex min-h-0 w-full flex-1 items-center justify-center pb-[clamp(0.75rem,3vh,1.5rem)]">
            <div className="relative w-full max-w-[min(35rem,100%)] shrink-0">
              <div
                ref={cardRegionRef}
                data-start-card-region
                className="relative h-[clamp(10rem,43dvh,21rem)] w-full overflow-visible"
              >
                <BounceCards playIntro={false} managedShellMotion />
              </div>

              <div className="pointer-events-none absolute left-1/2 top-[62%] z-10 w-full max-w-[min(18rem,100%)] -translate-x-1/2">
                <PixelPanel
                  ref={menuRef}
                  data-start-menu
                  tone="forest"
                  padding="sm"
                  className="pointer-events-auto flex w-full shrink-0 flex-col items-center gap-[clamp(0.28rem,1.2vw,0.5rem)] shadow-2xl shadow-black/45"
                >
                  <PixelButton
                    onClick={enterGame}
                    disabled={transitioning || enteringLobby}
                    variant="accent"
                    fullWidth
                    className="h-[clamp(2.35rem,7.4vh,3rem)] px-1 text-sm sm:text-lg"
                  >
                    {loggedIn ? "进入游戏" : "登录"}
                  </PixelButton>
                  <PixelButton
                    title={soundEnabled ? "关闭音效" : "开启音效"}
                    onClick={() => setSoundEnabled((value) => !value)}
                    disabled={transitioning}
                    variant="ghost"
                    fullWidth
                    className="h-[clamp(2.35rem,7.4vh,3rem)] px-1 text-xs sm:text-base"
                  >
                    设置
                  </PixelButton>
                  {loggedIn ? (
                    <PixelButton
                      onClick={() => setLogoutConfirmOpen(true)}
                      disabled={transitioning}
                      variant="danger"
                      fullWidth
                      className="h-[clamp(2.35rem,7.4vh,3rem)] px-1 text-xs sm:text-base"
                    >
                      退出登录
                    </PixelButton>
                  ) : null}
                </PixelPanel>
              </div>
            </div>
          </div>
        </section>
      </div>
      {logoutConfirmOpen ? (
        <PixelModal title="确认退出" onClose={() => setLogoutConfirmOpen(false)}>
          <div className="mt-5 space-y-5 text-left">
            <p className="text-sm leading-6 text-[#f7f0dc]">确定要退出当前账号吗？退出后需要重新登录才能进入大厅。</p>
            <div className="grid grid-cols-2 gap-3">
              <PixelButton onClick={() => setLogoutConfirmOpen(false)} variant="ghost" fullWidth>
                取消
              </PixelButton>
              <PixelButton onClick={logoutFromStart} variant="danger" fullWidth>
                确认退出
              </PixelButton>
            </div>
          </div>
        </PixelModal>
      ) : null}
    </main>
  );
}
