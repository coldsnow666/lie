/**
 * 大厅页面：登录后创建房间、加入房间并展示连接状态。
 */
"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { LogOut, Plus, PlugZap, Users } from "lucide-react";
import AuthGuard from "@/components/auth/AuthGuard";
import AppShell from "@/components/layout/AppShell";
import { logout } from "@/lib/api";
import { type StoredUser } from "@/lib/auth";
import { disconnectSocket, emitWithAck, createSocket } from "@/lib/socket";

type PublicRoom = {
  id: string;
  code: string;
  status: "waiting" | "playing" | "finished";
  players: Array<{
    playerId: string;
    userId: string;
    nickname: string;
    seatIndex: number;
    connected: boolean;
    ready: boolean;
  }>;
};

export default function LobbyPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [connectionState, setConnectionState] = useState("未连接");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const socket = createSocket();
      // 连接状态来自 Socket 生命周期事件，避免页面自己推断实时连接是否可用。
      queueMicrotask(() => setConnectionState(socket.connected ? "已连接" : "连接中"));
      socket.on("connect", () => setConnectionState("已连接"));
      socket.on("disconnect", () => setConnectionState("已断开"));
      socket.on("connect_error", () => setConnectionState("连接失败"));

      return () => {
        socket.off("connect");
        socket.off("disconnect");
        socket.off("connect_error");
      };
    } catch {
      queueMicrotask(() => setConnectionState("未登录"));
    }
  }, []);

  const enterRoom = useCallback(
    (room: PublicRoom) => {
      // 动态路由展示房间码，roomId 作为真实同步标识传入查询参数。
      router.push(`/room/${room.code}?roomId=${room.id}`);
    },
    [router],
  );

  async function handleCreateRoom() {
    setBusy(true);
    setMessage("");

    try {
      const data = await emitWithAck<{ room: PublicRoom }>("room:create", {});
      enterRoom(data.room);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建房间失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const data = await emitWithAck<{ room: PublicRoom }>("room:join", {
        roomCode: roomCode.toUpperCase(),
      });
      enterRoom(data.room);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加入房间失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await logout();
    disconnectSocket();
    router.push("/login");
  }

  return (
    <AuthGuard onUser={setUser}>
      <AppShell>
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <section className="rounded border border-[#d7bc72]/30 bg-[#10271d]/95 p-6">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold text-[#fff6cf]">欢迎，{user?.nickname ?? "玩家"}</h1>
                <p className="mt-2 text-sm text-[#c6b889]">创建一桌新游戏，或输入房间码加入朋友的桌子。</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-10 items-center gap-2 rounded border border-white/10 bg-black/20 px-3 text-sm text-[#c6b889]">
                  <PlugZap size={16} />
                  {connectionState}
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex h-10 items-center gap-2 rounded border border-white/15 px-3 text-sm text-[#fff6cf] transition hover:border-[#d7bc72]"
                >
                  <LogOut size={16} />
                  退出登录
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleCreateRoom}
                disabled={busy}
                className="flex min-h-32 flex-col items-center justify-center gap-3 rounded border border-[#d7bc72]/40 bg-[#d7bc72] p-4 text-[#102018] transition hover:bg-[#f0d98d] disabled:opacity-60"
              >
                <Plus size={28} />
                <span className="text-lg font-bold">创建房间</span>
              </button>

              <form onSubmit={handleJoinRoom} className="min-h-32 rounded border border-white/10 bg-black/20 p-4">
                <label className="block text-sm text-[#e8ddb7]">
                  房间码
                  <input
                    value={roomCode}
                    onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                    maxLength={8}
                    required
                    className="mt-2 w-full rounded border border-white/15 bg-black/25 px-3 py-3 text-lg font-bold uppercase tracking-[0.2em] text-[#fff6cf] outline-none focus:border-[#d7bc72]"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded border border-[#d7bc72]/50 font-semibold text-[#fff6cf] transition hover:border-[#f0d98d] disabled:opacity-60"
                >
                  <Users size={17} />
                  加入房间
                </button>
              </form>
            </div>

            {message ? <p className="mt-4 rounded border border-red-300/30 bg-red-950/40 px-3 py-2 text-sm text-red-100">{message}</p> : null}
          </section>

          <aside className="rounded border border-white/10 bg-black/20 p-5">
            <h2 className="text-sm font-semibold text-[#fff6cf]">对局规则</h2>
            <div className="mt-4 grid gap-3 text-sm text-[#c6b889]">
              <p>2 到 6 名玩家，标准 52 张牌。</p>
              <p>目标牌点按 A 到 K 循环推进。</p>
              <p>服务端判定真假，客户端只提交行动意图。</p>
            </div>
          </aside>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
