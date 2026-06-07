/**
 * 传统游戏启动页：展示游戏名、进入游戏、注册和基础设置入口。
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Settings, Spade, UserPlus, Volume2, VolumeX } from "lucide-react";
import { GAME_VERSION } from "@lie/shared";
import Ferrofluid from "@/components/backgrounds/Ferrofluid";
import { isLoggedIn } from "@/lib/auth";

export default function StartScreen() {
  const router = useRouter();
  const [soundEnabled, setSoundEnabled] = useState(true);

  function enterGame() {
    // 入口按钮按本地 token 判断跳转，真正鉴权仍由大厅 AuthGuard 负责。
    router.push(isLoggedIn() ? "/lobby" : "/login");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b1812] text-[#f7f0dc]">
      <div className="absolute inset-0">
        <Ferrofluid
          colors={["#d7bc72", "#2fd08f", "#fff6cf"]}
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
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(215,188,114,0.16),transparent_28%),linear-gradient(180deg,rgba(5,10,8,0.25),rgba(5,10,8,0.88))]" />
      <div className="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(0,0,0,0.65),transparent)]" />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-[#f2df9e]">
            <span className="grid h-11 w-11 place-items-center rounded border border-[#d7bc72]/60 bg-[#13261d]">
              <Spade size={22} />
            </span>
            <span className="text-sm font-medium">Cheat / Bullshit / Liar</span>
          </div>

          <button
            type="button"
            title={soundEnabled ? "关闭音效" : "开启音效"}
            onClick={() => setSoundEnabled((value) => !value)}
            className="grid h-10 w-10 place-items-center rounded border border-white/15 bg-black/20 text-[#f2df9e] transition hover:border-[#d7bc72]"
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>

        <section className="flex flex-1 flex-col items-center justify-center gap-8 py-10 text-center">
          <div className="relative h-48 w-64">
            {["A", "Q", "7", "K"].map((rank, index) => (
              <div
                key={rank}
                className="absolute left-1/2 top-1/2 grid h-40 w-28 origin-bottom -translate-x-1/2 -translate-y-1/2 place-items-center rounded border-2 border-[#e8ddb7] bg-[#f7f0dc] text-5xl font-bold text-[#173b2a] shadow-2xl shadow-black/50"
                style={{
                  transform: `translate(-50%, -50%) rotate(${(index - 1.5) * 12}deg) translateY(${Math.abs(index - 1.5) * 4}px)`,
                  zIndex: index,
                }}
              >
                {rank}
              </div>
            ))}
          </div>

          <div>
            <p className="mb-3 text-sm uppercase tracking-[0.28em] text-[#d7bc72]">real-time card table</p>
            <h1 className="text-6xl font-black tracking-normal text-[#fff6cf] sm:text-8xl">唬牌</h1>
          </div>

          <div className="grid w-full max-w-sm gap-3">
            <button
              type="button"
              onClick={enterGame}
              className="h-14 rounded bg-[#d7bc72] text-lg font-bold text-[#102018] shadow-lg shadow-black/30 transition hover:bg-[#f0d98d] disabled:opacity-60"
            >
              进入游戏
            </button>
            <Link
              href="/register"
              className="flex h-12 items-center justify-center gap-2 rounded border border-[#d7bc72]/50 bg-black/25 font-semibold text-[#fff6cf] transition hover:border-[#f0d98d]"
            >
              <UserPlus size={18} />
              注册
            </Link>
            <button
              type="button"
              title="基础设置"
              className="flex h-11 items-center justify-center gap-2 rounded border border-white/10 bg-black/15 text-sm text-[#c6b889]"
            >
              <Settings size={16} />
              设置
            </button>
          </div>
        </section>

        <footer className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-[#c6b889]">
          <span>{GAME_VERSION}</span>
          <span>2-6 players</span>
        </footer>
      </div>
    </main>
  );
}
