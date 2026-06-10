/**
 * 房间页面：等待房间和游戏桌面的统一入口，负责同步 Socket 状态。
 */
"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DECLARABLE_RANKS, type Card, type DeclaredRank } from "@lie/shared";
import { Copy, DoorOpen, Play, ScrollText, ToggleLeft, ToggleRight } from "lucide-react";
import type { PublicGameEvent, PublicGameState } from "@lie/shared";
import AuthGuard from "@/components/auth/AuthGuard";
import DomPlayingCard from "@/components/game/DomPlayingCard";
import GameTable from "@/components/game/GameTable";
import AppShell from "@/components/layout/AppShell";
import PixelButton from "@/components/ui/PixelButton";
import PixelMessage from "@/components/ui/PixelMessage";
import { type StoredUser } from "@/lib/auth";
import { createSocket, disconnectSocket, emitWithAck, getSocket } from "@/lib/socket";
import { joinRoom, leaveRoomByHttp, leaveRoomOnPageExit } from "@/service/modules/game";


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

type RoomSyncPayload = {
  room: PublicRoom;
  gameState: PublicGameState | null;
};

const routeExitLeaveTimers = new Map<string, number>();
const WAITING_OWNER_CARD: Card = { id: "waiting-owner-AH", rank: "A", suit: "H" };
const WAITING_CARD_POOL: Card[] = [
  { id: "waiting-AS", rank: "A", suit: "S" },
  { id: "waiting-KH", rank: "K", suit: "H" },
  { id: "waiting-QD", rank: "Q", suit: "D" },
  { id: "waiting-JC", rank: "J", suit: "C" },
  { id: "waiting-10S", rank: "10", suit: "S" },
  { id: "waiting-9H", rank: "9", suit: "H" },
  { id: "waiting-8D", rank: "8", suit: "D" },
  { id: "waiting-7C", rank: "7", suit: "C" },
];

function cancelRouteExitLeave(roomId: string) {
  const timer = routeExitLeaveTimers.get(roomId);
  if (!timer) {
    return;
  }

  window.clearTimeout(timer);
  routeExitLeaveTimers.delete(roomId);
}

function scheduleRouteExitLeave(roomId: string, leave: () => void) {
  cancelRouteExitLeave(roomId);
  const timer = window.setTimeout(() => {
    routeExitLeaveTimers.delete(roomId);
    leave();
  }, 300);

  routeExitLeaveTimers.set(roomId, timer);
}

function describeRoomLog(event: PublicGameEvent) {
  if (event.type === "room_joined") {
    return `${event.nickname} 进入房间`;
  }

  if (event.type === "room_left") {
    return `${event.nickname} 离开房间`;
  }

  if (event.type === "room_owner_changed") {
    return `${event.nickname} 成为房主`;
  }

  if (event.type === "player_connected") {
    return "玩家重新连接";
  }

  if (event.type === "player_disconnected") {
    return "玩家断开连接";
  }

  if (event.type === "cards_played") {
    return `玩家声明 ${event.declaredRank}，打出 ${event.cardCount} 张`;
  }

  if (event.type === "challenge_resolved") {
    return event.wasTruthful ? "质疑失败，质疑者拿走弃牌堆" : "质疑成功，上一手玩家拿走弃牌堆";
  }

  return "房间状态已更新";
}

function hashText(value: string) {
  return Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
}

function waitingCardForPlayer(player: Player) {
  return WAITING_CARD_POOL[hashText(player.playerId) % WAITING_CARD_POOL.length];
}

function WaitingPlayerCard({ ownerUserId, player, slotIndex }: { ownerUserId: string | null; player: Player | null; slotIndex: number }) {
  const isOwner = Boolean(player && ownerUserId === player.userId);
  const statusText = player ? (isOwner ? "房主" : player.ready ? "已准备" : "等待准备") : "等待玩家进入";
  const card = player ? (isOwner ? WAITING_OWNER_CARD : waitingCardForPlayer(player)) : null;
  const tiltSeed = hashText(player?.playerId ?? `empty-slot-${slotIndex}`);
  const rotateZ = (tiltSeed % 11) - 5;
  const rotateX = ((tiltSeed >> 3) % 7) - 3;
  const rotateY = ((tiltSeed >> 5) % 9) - 4;

  return (
    <article className="group relative isolate mx-auto w-[6.5rem] [perspective:850px] sm:w-[9.4rem]">
      <div
        className="relative transition-transform duration-300 ease-out [transform-style:preserve-3d] group-hover:-translate-y-2 group-hover:[transform:rotateX(8deg)_rotateY(-10deg)_rotateZ(var(--waiting-card-tilt-hover))]"
        style={
          {
            "--waiting-card-tilt-hover": `${rotateZ * 0.45}deg`,
            transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`,
          } as CSSProperties
        }
      >
        {player && card ? (
          <DomPlayingCard
            card={card}
            displayRank={player.nickname}
            label={`${player.nickname}${isOwner ? " 红心A房主" : ""}`}
            className="[--pixel-card-scale:2.05] drop-shadow-[0_8px_0_rgba(8,13,14,0.36)] sm:[--pixel-card-scale:3.05] sm:drop-shadow-[0_14px_0_rgba(8,13,14,0.36)]"
          />
        ) : (
          <DomPlayingCard
            joker="black"
            label="等待玩家进入"
            jokerLetters={["等", "待", "玩", "家", "进", "入"]}
            className="[--pixel-card-scale:2.05] opacity-80 drop-shadow-[0_8px_0_rgba(8,13,14,0.3)] sm:[--pixel-card-scale:3.05] sm:drop-shadow-[0_14px_0_rgba(8,13,14,0.3)]"
          />
        )}
        <div className="absolute bottom-[9%] left-[8%] z-10 w-[66%] -rotate-6 border-2 border-[#17251f] bg-[#fff6cf]/95 px-1.5 py-0.5 text-center shadow-[3px_3px_0_#17251f] sm:py-1">
          <div className="truncate text-[0.68rem] font-black leading-none text-[#17251f]">{statusText}</div>
          {player ? (
            <div className={player.connected ? "mt-0.5 text-[0.58rem] font-black leading-none text-emerald-700" : "mt-0.5 text-[0.58rem] font-black leading-none text-red-700"}>
              {player.connected ? "在线" : "离线"}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function WaitingRoomActions({
  busy,
  canStart,
  isOwner,
  onLeave,
  onReady,
  onStartGame,
  selfPlayer,
}: {
  busy: boolean;
  canStart: boolean;
  isOwner: boolean;
  onLeave: () => void;
  onReady: () => void;
  onStartGame: () => void;
  selfPlayer: Player | null;
}) {
  return (
    <div className="grid w-full grid-cols-2 items-center gap-2 lg:flex lg:flex-wrap lg:gap-3">
      {!isOwner ? (
        <PixelButton onClick={onReady} disabled={busy || !selfPlayer} variant="ghost" size="sm" className="h-9 min-w-0 px-2 text-xs lg:h-10 lg:flex-1 lg:px-4">
          {selfPlayer?.ready ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          {selfPlayer?.ready ? "取消准备" : "准备"}
        </PixelButton>
      ) : null}
      {isOwner ? (
        <PixelButton onClick={onStartGame} disabled={busy || !canStart} variant="primary" size="sm" className="h-9 min-w-0 px-2 text-xs lg:h-10 lg:flex-1 lg:px-4">
          <Play size={18} />
          开始游戏
        </PixelButton>
      ) : null}
      <PixelButton onClick={onLeave} disabled={busy} variant="danger" size="sm" className="h-9 min-w-0 px-2 text-xs lg:h-10 lg:flex-1 lg:px-4">
        <DoorOpen size={18} />
        离开
      </PixelButton>
    </div>
  );
}

function WaitingRoomBoard({
  busy,
  canStart,
  events,
  isOwner,
  onCopyRoomCode,
  onLeave,
  onReady,
  onStartGame,
  room,
  roomCode,
  selfPlayer,
}: {
  busy: boolean;
  canStart: boolean;
  events: PublicGameEvent[];
  isOwner: boolean;
  onCopyRoomCode: () => void;
  onLeave: () => void;
  onReady: () => void;
  onStartGame: () => void;
  room: PublicRoom | null;
  roomCode?: string;
  selfPlayer: Player | null;
}) {
  const roomLogs = events.slice().reverse();
  const maxPlayers = room?.maxPlayers ?? 0;
  const sortedPlayers = [...(room?.players ?? [])].sort((left, right) => {
    if (left.userId === room?.ownerUserId) {
      return -1;
    }

    if (right.userId === room?.ownerUserId) {
      return 1;
    }

    return left.seatIndex - right.seatIndex;
  });
  const playerSlots = Array.from({ length: maxPlayers }, (_, index) => sortedPlayers[index] ?? null);

  return (
    <section className="grid h-dvh max-h-dvh min-h-0 grid-rows-[minmax(0,1fr)_minmax(12rem,28dvh)] overflow-hidden lg:grid-cols-[minmax(0,1fr)_21rem] lg:grid-rows-none">
      <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden px-3 py-2 sm:px-6 lg:px-5 lg:py-8">
        <div className="grid shrink-0 gap-1.5 rounded border-2 border-[#c4c2d7] bg-[#243036]/78 px-3 py-2 shadow-[-3px_6px_0_#182126] sm:gap-4 sm:px-5 sm:py-4 sm:shadow-[-4px_8px_0_#182126] lg:block">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[0.68rem] font-black tracking-[0.08em] text-[#c6b889] sm:text-sm">房间码</p>
              <h1 className="mt-0.5 text-xl font-black tracking-[0.12em] text-[#fff6cf] sm:mt-2 sm:text-5xl sm:tracking-[0.16em]">{room?.code ?? roomCode}</h1>
            </div>
            <PixelButton onClick={onCopyRoomCode} variant="ghost" size="sm" className="h-8 px-3 text-xs sm:h-10 sm:px-4">
              <Copy size={16} />
              复制
            </PixelButton>
          </div>
          <div className="grid gap-1.5 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.66rem] font-black tracking-[0.16em] text-[#bfc7ff]">等待开始</p>
                <h2 className="text-lg font-black text-white">{room?.players.length ?? 0}/{room?.maxPlayers ?? 0}</h2>
              </div>
              <span className="border-2 border-[#9aa4ff] bg-[#1e2476] px-2 py-0.5 text-xs font-black text-[#fff6cf]">
                {isOwner ? "房主" : "玩家"}
              </span>
            </div>
            <WaitingRoomActions
              busy={busy}
              canStart={canStart}
              isOwner={isOwner}
              onLeave={onLeave}
              onReady={onReady}
              onStartGame={onStartGame}
              selfPlayer={selfPlayer}
            />
          </div>
        </div>

        <div className="mx-auto grid min-h-0 w-full max-w-[14.5rem] grid-cols-2 content-center items-center justify-items-center gap-x-2 gap-y-2 overflow-hidden py-1 sm:max-w-[20.5rem] sm:gap-x-5 sm:gap-y-7 sm:py-6">
          {playerSlots.map((player, index) => (
            <WaitingPlayerCard key={player?.playerId ?? `empty-slot-${index}`} ownerUserId={room?.ownerUserId ?? null} player={player} slotIndex={index} />
          ))}
        </div>
      </div>

      <aside className="grid min-h-0 grid-rows-[minmax(0,1fr)] gap-2 border-2 border-[#8a93ff] bg-[#292f91]/95 p-2 text-[#f5f1ff] shadow-[-4px_7px_0_#151951] lg:sticky lg:top-0 lg:h-dvh lg:max-h-dvh lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-4 lg:border-x-2 lg:border-y-0 lg:p-4 lg:shadow-[-5px_10px_0_#151951]">
        <div className="hidden shrink-0 lg:block">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[0.68rem] font-black tracking-[0.16em] text-[#bfc7ff] lg:text-xs">等待开始</p>
              <h2 className="text-xl font-black text-white lg:mt-1 lg:text-2xl">{room?.players.length ?? 0}/{room?.maxPlayers ?? 0}</h2>
            </div>
            <span className="border-2 border-[#9aa4ff] bg-[#1e2476] px-2 py-1 text-xs font-black text-[#fff6cf]">
              {isOwner ? "房主" : "玩家"}
            </span>
          </div>

          <div className="mt-5">
            <WaitingRoomActions
              busy={busy}
              canStart={canStart}
              isOwner={isOwner}
              onLeave={onLeave}
              onReady={onReady}
              onStartGame={onStartGame}
              selfPlayer={selfPlayer}
            />
          </div>
        </div>

        <div className="min-h-0 overflow-hidden border-2 border-[#6f7cff] bg-[#161b5c] p-2 lg:p-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-black text-[#fff6cf] lg:mb-3 lg:text-sm">
            <ScrollText size={16} />
            房间日志
          </div>
          <div className="grid max-h-full gap-1.5 overflow-y-auto pr-1 text-xs text-[#dfe3ff] lg:gap-2 lg:text-sm">
            {roomLogs.length ? (
              roomLogs.map((event, index) => (
                <div key={`${event.type}-${index}`}>
                  {describeRoomLog(event)}
                </div>
              ))
            ) : (
              <div>等待玩家进入房间。</div>
            )}
          </div>
        </div>
      </aside>
    </section>
  );
}

export default function RoomPage() {
  const router = useRouter();
  const params = useParams<{ roomCode: string }>();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [gameState, setGameState] = useState<PublicGameState | null>(null);
  const [events, setEvents] = useState<PublicGameEvent[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [declaredRank, setDeclaredRank] = useState<DeclaredRank>(DECLARABLE_RANKS[0]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const exitLeaveSentRef = useRef(false);

  const roomCode = params.roomCode?.toUpperCase();
  const roomId = room?.id ?? searchParams.get("roomId");
  const selfPlayer = useMemo(() => room?.players.find((player) => player.userId === user?.id) ?? null, [room, user]);
  const isOwner = Boolean(room?.ownerUserId && room.ownerUserId === user?.id);
  const pendingWinnerPlayerId = gameState?.players.find((player) => player.pendingWin)?.playerId ?? null;
  const canStart = Boolean(isOwner && room && room.players.length === room.maxPlayers && room.status === "waiting");

  const syncRoom = useCallback(async () => {
    if (!roomId || !user) {
      return;
    }

    try {
      // 刷新或重进房间时，通过 roomId 主动同步当前房间和游戏状态。
      const data = await emitWithAck<RoomSyncPayload>("game:sync", { roomId });
      setRoom(data.room);
      setEvents(data.room.events ?? []);
      if (data.gameState) {
        setGameState(data.gameState);
        setSelectedCardIds((selected) => selected.filter((cardId) => data.gameState?.selfHand.some((card) => card.id === cardId)));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步房间失败";

      if (message === "你不在这个房间" && roomCode) {
        try {
          // 页面进入时如果 REST 加入与 Socket 同步之间状态被打断，用房间码补一次加入再同步。
          const joinedRoom = await joinRoom({ roomCode });
          const data = await emitWithAck<RoomSyncPayload>("game:sync", { roomId: joinedRoom.id });
          setRoom(data.room);
          setEvents(data.room.events ?? []);
          if (data.gameState) {
            setGameState(data.gameState);
          }
          setMessage("");
          return;
        } catch (fallbackError) {
          setMessage(fallbackError instanceof Error ? fallbackError.message : message);
          return;
        }
      }

      setMessage(message);
    }
  }, [roomCode, roomId, user]);

  useEffect(() => {
    if (!roomId || !user) {
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
  }, [roomId, syncRoom, user]);

  useEffect(() => {
    if (!roomId || !user || gameState) {
      return;
    }

    // 等待页不能只依赖 Socket 推送；开局瞬间如果 room/game 事件丢失，
    // 玩家会停在房间界面，所以这里持续主动拉取自己的权威游戏状态。
    const syncInterval = window.setInterval(() => {
      void syncRoom();
    }, 1200);

    return () => {
      window.clearInterval(syncInterval);
    };
  }, [gameState, roomId, syncRoom, user]);

  useEffect(() => {
    if (!roomId || !user) {
      return;
    }

    const activeRoomId = roomId;
    cancelRouteExitLeave(activeRoomId);

    function leaveOnExit() {
      if (exitLeaveSentRef.current) {
        return;
      }

      exitLeaveSentRef.current = true;
      getSocket()?.emit("room:leave", { roomId: activeRoomId });
      leaveRoomOnPageExit(activeRoomId);
      disconnectSocket();
    }

    window.addEventListener("pagehide", leaveOnExit);

    return () => {
      window.removeEventListener("pagehide", leaveOnExit);
      // React 开发模式会模拟一次卸载/重挂载；延迟执行并允许重挂载取消，避免刚进房就误删房间。
      scheduleRouteExitLeave(activeRoomId, leaveOnExit);
    };
  }, [roomId, user]);

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
      exitLeaveSentRef.current = true;
      try {
        await emitWithAck("room:leave", { roomId });
      } catch {
        // Socket ack 在网络切换或页面快速跳转时可能丢失，HTTP 离开接口作为显式按钮兜底。
        await leaveRoomByHttp(roomId);
      }
      disconnectSocket();
      router.push("/lobby");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "离开房间失败");
    } finally {
      setBusy(false);
    }
  }

  async function ready() {
    if (!roomId || !selfPlayer || isOwner) {
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
      const data = await emitWithAck<RoomSyncPayload>("game:start", { roomId });
      setRoom(data.room);
      setEvents(data.room.events ?? []);
      if (data.gameState) {
        setGameState(data.gameState);
      }
      await syncRoom();
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
      const resolvingPendingWin =
        Boolean(gameState?.lastPlay) &&
        Boolean(pendingWinnerPlayerId) &&
        pendingWinnerPlayerId !== selfPlayer?.playerId;

      await emitWithAck("game:playCards", {
        roomId,
        cardIds: resolvingPendingWin ? [] : selectedCardIds,
        declaredRank: resolvingPendingWin ? undefined : declaredRank,
      });
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
      <AppShell edgeToEdge>
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
            declaredRank={declaredRank}
            onDeclaredRankChange={setDeclaredRank}
            onToggleCard={toggleCard}
            onPlayCards={playCards}
            onChallenge={challenge}
            onLeave={leave}
            busy={busy}
          />
        ) : (
          <WaitingRoomBoard
            busy={busy}
            canStart={canStart}
            events={events}
            isOwner={isOwner}
            onCopyRoomCode={() => navigator.clipboard?.writeText(room?.code ?? roomCode)}
            onLeave={leave}
            onReady={ready}
            onStartGame={startGame}
            room={room}
            roomCode={roomCode}
            selfPlayer={selfPlayer}
          />
        )}
      </AppShell>
    </AuthGuard>
  );
}
