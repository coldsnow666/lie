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
import PixelButton from "@/components/ui/PixelButton";
import PixelMessage from "@/components/ui/PixelMessage";
import PixelPanel from "@/components/ui/PixelPanel";
import { type StoredUser } from "@/lib/auth";
import { createSocket, emitWithAck } from "@/lib/socket";


type Player = {
  playerId: string;
  userId: string;
  nickname: string;
  seatIndex: number;
  connected: boolean;
  ready: boolean;
}


type PublicRoom = {
  id: string;
  code: string;
  status: "waiting" | "playing" | "finished";
  ownerUserId: string | null;
  maxPlayers: number;
  players: Array<Player>;
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

  return (
    <AuthGuard onUser={setUser}>
      <AppShell>
        {!roomId ? (
          <PixelMessage className="mb-4" placement="inline">
            缺少房间 ID，请从大厅重新加入。
          </PixelMessage>
        ) : null}

        {message ? (
          <PixelMessage className="mb-4" placement="inline">
            {message}
          </PixelMessage>
        ) : null}

        {gameState ? (
          <GameTable
            state={gameState}
            events={events}
            selectedCardIds={selectedCardIds}
            onToggleCard={toggleCard}
            onPlayCards={playCards}
            onChallenge={challenge}
            onLeave={leave}
            busy={busy}
          />
        ) : (
          <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <PixelPanel tone="forest" padding="lg">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-[#c6b889]">房间码</p>
                  <h1 className="mt-1 text-4xl font-black tracking-[0.18em] text-[#fff6cf]">{room?.code ?? roomCode}</h1>
                </div>
                <PixelButton onClick={() => navigator.clipboard?.writeText(room?.code ?? roomCode)} variant="ghost" size="sm">
                  <Copy size={16} />
                  复制
                </PixelButton>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {room?.players.map((player) => (
                  <PlayerSeat key={player.playerId} player={player} owner={player.userId === room.ownerUserId} />
                ))}
              </div>
            </PixelPanel>

            <PixelPanel tone="dark" padding="md">
              <h2 className="text-sm font-semibold text-[#fff6cf]">等待开始</h2>
              <div className="mt-4 grid gap-3">
                <PixelButton onClick={ready} disabled={busy || !selfPlayer} variant="ghost">
                  {selfPlayer?.ready ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  {selfPlayer?.ready ? "取消准备" : "准备"}
                </PixelButton>
                <PixelButton onClick={leave} disabled={busy} variant="danger">
                  <DoorOpen size={18} />
                  离开
                </PixelButton>
                <PixelButton onClick={startGame} disabled={busy || !canStart} variant="primary">
                  <Play size={18} />
                  开始游戏
                </PixelButton>
                <p className="text-sm text-[#c6b889]">房主在 2 到 6 人时可以开始游戏。</p>
              </div>
            </PixelPanel>
          </section>
        )}
      </AppShell>
    </AuthGuard>
  );
}
