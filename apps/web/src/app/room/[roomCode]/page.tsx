/**
 * 房间页面：等待房间和游戏桌面的统一入口，负责同步 Socket 状态。
 */
"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, DoorOpen, Play, ToggleLeft, ToggleRight } from "lucide-react";
import type { PublicGameEvent, PublicGameState } from "@lie/shared";
import AuthGuard from "@/components/auth/AuthGuard";
import GameTable from "@/components/game/GameTable";
import PlayerSeat from "@/components/game/PlayerSeat";
import AppShell from "@/components/layout/AppShell";
import { type StoredUser } from "@/lib/auth";
import { createSocket, emitWithAck } from "@/lib/socket";

type PublicRoom = {
  id: string;
  code: string;
  status: "waiting" | "playing" | "finished";
  ownerUserId: string | null;
  maxPlayers: number;
  players: Array<{
    playerId: string;
    userId: string;
    nickname: string;
    seatIndex: number;
    connected: boolean;
    ready: boolean;
  }>;
  events: PublicGameEvent[];
};

export default function RoomPage() {
  const router = useRouter();
  const params = useParams<{ roomCode: string }>();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [gameState, setGameState] = useState<PublicGameState | null>(null);
  const [events, setEvents] = useState<PublicGameEvent[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const roomCode = params.roomCode?.toUpperCase();
  const roomId = room?.id ?? searchParams.get("roomId");
  const selfPlayer = useMemo(() => room?.players.find((player) => player.userId === user?.id) ?? null, [room, user]);
  const isOwner = Boolean(room?.ownerUserId && room.ownerUserId === user?.id);
  const canStart = Boolean(isOwner && room && room.players.length >= 2 && room.players.length <= 6 && room.status === "waiting");

  const syncRoom = useCallback(async () => {
    if (!roomId) {
      return;
    }

    try {
      // 刷新或重进房间时，通过 roomId 主动同步当前房间和游戏状态。
      const data = await emitWithAck<{ room: PublicRoom }>("game:sync", { roomId });
      setRoom(data.room);
      setEvents(data.room.events ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "同步房间失败");
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) {
      return;
    }

    const socket = createSocket();
    socket.emit("game:sync", { roomId });

    function onRoomUpdated(nextRoom: PublicRoom) {
      if (nextRoom.id === roomId) {
        setRoom(nextRoom);
        setEvents(nextRoom.events ?? []);
      }
    }

    function onGameUpdated(nextState: PublicGameState) {
      if (nextState.roomId === roomId) {
        setGameState(nextState);
        // 服务端出牌后会更新 selfHand，这里移除已经不在手牌中的选中项。
        setSelectedCardIds((selected) => selected.filter((cardId) => nextState.selfHand.some((card) => card.id === cardId)));
      }
    }

    function onGameEvent(event: PublicGameEvent) {
      setEvents((current) => [...current.slice(-29), event]);
    }

    socket.on("room:updated", onRoomUpdated);
    socket.on("game:updated", onGameUpdated);
    socket.on("game:event", onGameEvent);
    socket.on("game:challengeResolved", onGameEvent);

    const syncTimer = window.setTimeout(() => {
      void syncRoom();
    }, 0);

    return () => {
      window.clearTimeout(syncTimer);
      socket.off("room:updated", onRoomUpdated);
      socket.off("game:updated", onGameUpdated);
      socket.off("game:event", onGameEvent);
      socket.off("game:challengeResolved", onGameEvent);
    };
  }, [roomId, syncRoom]);

  function toggleCard(cardId: string) {
    setSelectedCardIds((current) => {
      if (current.includes(cardId)) {
        return current.filter((id) => id !== cardId);
      }

      if (current.length >= 4) {
        // MVP 规则单次最多打出 4 张，前端先限制，服务端仍会再次校验。
        return current;
      }

      return [...current, cardId];
    });
  }

  async function leave() {
    if (!roomId) {
      router.push("/lobby");
      return;
    }

    setBusy(true);
    try {
      await emitWithAck("room:leave", { roomId });
      router.push("/lobby");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "离开房间失败");
    } finally {
      setBusy(false);
    }
  }

  async function ready() {
    if (!roomId || !selfPlayer) {
      return;
    }

    setBusy(true);
    try {
      await emitWithAck("room:ready", { roomId, ready: !selfPlayer.ready });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "准备状态更新失败");
    } finally {
      setBusy(false);
    }
  }

  async function startGame() {
    if (!roomId) {
      return;
    }

    setBusy(true);
    try {
      await emitWithAck("game:start", { roomId });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "开始游戏失败");
    } finally {
      setBusy(false);
    }
  }

  async function playCards() {
    if (!roomId) {
      return;
    }

    setBusy(true);
    try {
      await emitWithAck("game:playCards", { roomId, cardIds: selectedCardIds });
      setSelectedCardIds([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "出牌失败");
    } finally {
      setBusy(false);
    }
  }

  async function challenge() {
    if (!roomId) {
      return;
    }

    setBusy(true);
    try {
      await emitWithAck("game:challenge", { roomId });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "质疑失败");
    } finally {
      setBusy(false);
    }
  }

  const actions = (
    <button
      type="button"
      onClick={leave}
      disabled={busy}
      className="flex h-10 items-center gap-2 rounded border border-white/15 px-3 text-sm text-[#fff6cf] transition hover:border-[#d7bc72] disabled:opacity-60"
    >
      <DoorOpen size={16} />
      离开
    </button>
  );

  return (
    <AuthGuard onUser={setUser}>
      <AppShell title={`房间 ${roomCode}`} actions={actions}>
        {!roomId ? (
          <div className="rounded border border-red-300/30 bg-red-950/40 p-4 text-red-100">缺少房间 ID，请从大厅重新加入。</div>
        ) : null}

        {message ? <div className="mb-4 rounded border border-red-300/30 bg-red-950/40 px-3 py-2 text-sm text-red-100">{message}</div> : null}

        {gameState ? (
          <GameTable
            state={gameState}
            events={events}
            selectedCardIds={selectedCardIds}
            onToggleCard={toggleCard}
            onPlayCards={playCards}
            onChallenge={challenge}
            busy={busy}
          />
        ) : (
          <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="rounded border border-[#d7bc72]/30 bg-[#10271d]/95 p-6">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-[#c6b889]">房间码</p>
                  <h1 className="mt-1 text-4xl font-black tracking-[0.18em] text-[#fff6cf]">{room?.code ?? roomCode}</h1>
                </div>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(room?.code ?? roomCode)}
                  className="flex h-10 items-center gap-2 rounded border border-[#d7bc72]/50 px-3 text-sm text-[#fff6cf]"
                >
                  <Copy size={16} />
                  复制
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {room?.players.map((player) => (
                  <PlayerSeat key={player.playerId} player={player} owner={player.userId === room.ownerUserId} />
                ))}
              </div>
            </div>

            <aside className="rounded border border-white/10 bg-black/20 p-5">
              <h2 className="text-sm font-semibold text-[#fff6cf]">等待开始</h2>
              <div className="mt-4 grid gap-3">
                <button
                  type="button"
                  onClick={ready}
                  disabled={busy || !selfPlayer}
                  className="flex h-11 items-center justify-center gap-2 rounded border border-[#d7bc72]/50 font-semibold text-[#fff6cf] transition hover:border-[#f0d98d] disabled:opacity-50"
                >
                  {selfPlayer?.ready ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  {selfPlayer?.ready ? "取消准备" : "准备"}
                </button>
                <button
                  type="button"
                  onClick={startGame}
                  disabled={busy || !canStart}
                  className="flex h-11 items-center justify-center gap-2 rounded bg-[#d7bc72] font-semibold text-[#102018] transition hover:bg-[#f0d98d] disabled:opacity-50"
                >
                  <Play size={18} />
                  开始游戏
                </button>
                <p className="text-sm text-[#c6b889]">房主在 2 到 6 人时可以开始游戏。</p>
              </div>
            </aside>
          </section>
        )}
      </AppShell>
    </AuthGuard>
  );
}
