/**
 * @Description: 认证页布局：固定左侧回飞扑克牌，只切换右侧登录或注册表单。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthTransitionProvider } from "@/features/auth/AuthTransitionContext";
import { useAuthScreenTransition } from "@/features/auth/hooks/useAuthScreenTransition";
import BounceCards from "@/features/start/BounceCards";

const LOGIN_BACK_SENTINEL_KEY = "__lieLoginBackSentinel";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const { cardRegionRef, formShellRef, playExit, transitioning } = useAuthScreenTransition();
  const popNavigatingRef = useRef(false);

  const navigateHome = useCallback(() => {
    playExit(() => router.push("/"));
  }, [playExit, router]);

  useEffect(() => {
    if (pathname !== "/login" || typeof window === "undefined") {
      popNavigatingRef.current = false;
      return;
    }

    const currentState = window.history.state ?? {};

    if (!currentState?.[LOGIN_BACK_SENTINEL_KEY]) {
      window.history.pushState(
        {
          ...currentState,
          [LOGIN_BACK_SENTINEL_KEY]: true,
        },
        "",
        window.location.href,
      );
    }

    const handlePopState = (event: PopStateEvent) => {
      if (popNavigatingRef.current) {
        return;
      }

      if (window.location.pathname !== "/login") {
        return;
      }

      if (event.state?.[LOGIN_BACK_SENTINEL_KEY]) {
        return;
      }

      popNavigatingRef.current = true;
      playExit(() => {
        window.history.back();
      });
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [pathname, playExit]);

  return (
    <AuthTransitionProvider value={{ navigateHome, transitioning }}>
      <main className="flex min-h-screen items-center overflow-x-clip px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
        <div className="mx-auto grid w-full max-w-[72rem] items-end gap-0 overflow-visible lg:grid-cols-[minmax(18rem,28rem)_31rem] lg:items-center lg:justify-center lg:gap-8 xl:max-w-[78rem] xl:gap-12">
          <section className="relative z-0 flex min-h-[12rem] items-end justify-center overflow-visible pt-0 sm:min-h-[15rem] sm:pt-1 lg:min-h-[24rem] lg:items-center lg:justify-center lg:pt-0">
            <div
              ref={cardRegionRef}
              className="relative h-[12.5rem] w-full max-w-[21rem] sm:h-[15rem] sm:max-w-[25rem] lg:h-[18rem] lg:max-w-[24rem] xl:h-[22rem] xl:max-w-[28rem]"
            >
              <div className="pointer-events-none absolute inset-0">
                <BounceCards
                  playIntro
                  introVariant="corner-return"
                  introFlightMode="viewport"
                  enableHover={false}
                  animationDelay={0.04}
                  animationStagger={0.04}
                  className="scale-[0.8] sm:scale-[0.9] lg:scale-[0.92] xl:scale-[0.98]"
                />
              </div>
            </div>
          </section>

          <section className="relative z-10 -mt-[4.5rem] flex justify-center sm:-mt-[5rem] lg:mt-0 lg:justify-start">
            <div ref={formShellRef} className="relative w-full max-w-[31rem]">
              {children}
            </div>
          </section>
        </div>
      </main>
    </AuthTransitionProvider>
  );
}
