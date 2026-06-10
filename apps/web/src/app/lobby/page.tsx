/**
 * 大厅页面：左侧展示大厅概览，右侧展示房间列表与房间操作入口。
 */
"use client";

import { useRouter } from "next/navigation";
import { FormEvent, type CSSProperties, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Crown, Plus, RefreshCw, Swords, Users } from "lucide-react";
import AuthGuard from "@/components/auth/AuthGuard";
import CardBackArt from "@/components/game/CardBackArt";
import DomPlayingCard from "@/components/game/DomPlayingCard";
import AppShell from "@/components/layout/AppShell";
import { useRouteLoading } from "@/components/loading/RouteLoadingProvider";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import PixelButton from "@/components/ui/PixelButton";
import PixelInput from "@/components/ui/PixelInput";
import PixelMessage from "@/components/ui/PixelMessage";
import PixelModal from "@/components/ui/PixelModal";
import PixelPanel from "@/components/ui/PixelPanel";
import PixelSelect from "@/components/ui/PixelSelect";
import { fetchRooms, joinRoom, createRoom, type PublicRoom } from "@/service/modules/game";

const roomStatusLabelMap: Record<PublicRoom["status"], string> = {
  waiting: "等待中",
  playing: "对局中",
  finished: "已结束",
};

type LobbyModalKind = "create" | "join";

const roomCardPoseList = [
  { rotate: -8, y: 0.45 },
  { rotate: -4, y: 0.1 },
  { rotate: 0, y: -0.08 },
  { rotate: 4, y: 0.1 },
  { rotate: 8, y: 0.45 },
  { rotate: -5, y: 0.25 },
];

function sortRooms(rooms: PublicRoom[]) {
  const statusWeight: Record<PublicRoom["status"], number> = {
    waiting: 0,
    playing: 1,
    finished: 2,
  };

  return [...rooms].sort((left, right) => {
    const statusDiff = statusWeight[left.status] - statusWeight[right.status];

    if (statusDiff !== 0) {
      return statusDiff;
    }

    const playerDiff = right.players.length - left.players.length;

    if (playerDiff !== 0) {
      return playerDiff;
    }

    return (right.updatedAt ?? 0) - (left.updatedAt ?? 0);
  });
}

function resolveOwnerName(room: PublicRoom) {
  const owner = room.players.find((player) => player.userId === room.ownerUserId);
  return owner?.nickname ?? room.players[0]?.nickname ?? "未知房主";
}

function LobbyHeaderActions({
  onBackHome,
  onCreateRoom,
  onJoinRoom,
  onRefreshRooms,
  pendingAction,
  refreshingRooms,
}: {
  onBackHome: () => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onRefreshRooms: () => void;
  pendingAction: string | null;
  refreshingRooms: boolean;
}) {
  return (
    <div className="shrink-0 flex flex-wrap items-center justify-between gap-4 xl:items-start">
      <div className="flex min-w-0 items-start gap-3">
        <PixelButton
          onClick={onBackHome}
          variant="ghost"
          size="sm"
          square
          aria-label="返回主页"
          className="mt-1 h-9 w-9.5 shrink-0"
        >
          <ArrowLeft size={22} />
        </PixelButton>
        <div className="min-w-0">
          <h2 className="mt-2 text-2xl font-black text-[#fff6cf]">房间列表</h2>
        </div>
      </div>
      <div className="flex w-full flex-wrap items-center justify-end gap-2 xl:w-auto">
        <PixelButton onClick={onCreateRoom} disabled={Boolean(pendingAction)} variant="primary" size="sm">
          创建房间
        </PixelButton>
        <PixelButton onClick={onJoinRoom} disabled={Boolean(pendingAction)} variant="ghost" size="sm">
          加入房间
        </PixelButton>
        <PixelButton
          onClick={onRefreshRooms}
          disabled={refreshingRooms}
          variant="secondary"
          size="sm"
          square
          aria-label={refreshingRooms ? "刷新中" : "刷新列表"}
          title={refreshingRooms ? "刷新中" : "刷新列表"}
          className="h-9 w-9.5 shrink-0"
        >
          <RefreshCw size={18} className={refreshingRooms ? "animate-spin" : ""} />
        </PixelButton>
      </div>
    </div>
  );
}

function RoomSkeletonList() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <PixelPanel key={`room-skeleton-${index}`} tone="dark" padding="md" className="min-h-44 animate-pulse">
          <div className="h-6 w-24 rounded bg-white/8" />
          <div className="mt-4 h-4 w-36 rounded bg-white/6" />
          <div className="mt-3 h-4 w-28 rounded bg-white/6" />
          <div className="mt-8 h-11 w-full rounded bg-white/7" />
        </PixelPanel>
      ))}
    </div>
  );
}

function EmptyRoomCard() {
  const [backIndex] = useState(() => Math.floor(Math.random() * 4));

  return (
    <div className="grid min-h-full place-items-center py-4">
      <div className="flex flex-col items-center gap-5">
        <div className="lie-lobby-empty-card-stage">
          <div className="lie-lobby-empty-card-spin">
            <div className="lie-lobby-empty-card-side">
              <DomPlayingCard joker="red" label="当前没有公开房间" className="[--pixel-card-scale:3.05]" />
            </div>
            <div className="lie-lobby-empty-card-side lie-lobby-empty-card-back">
              <CardBackArt
                back={backIndex}
                label={`空房间随机牌背 ${backIndex + 1}`}
                className="[--card-back-art-height:65px] [--card-back-art-width:49px] [--card-back-scale:3.05]"
              />
            </div>
          </div>
        </div>
        <span className="text-center text-sm font-black tracking-[0.08em] text-[#fff6cf]">
          当前没有公开房间
        </span>
      </div>
    </div>
  );
}

function RoomCard({
  index,
  onJoin,
  pendingAction,
  room,
}: {
  index: number;
  onJoin: (roomCode: string, actionKey: string) => void;
  pendingAction: string | null;
  room: PublicRoom;
}) {
  const ownerName = resolveOwnerName(room);
  const isJoinable = room.status === "waiting" && room.players.length < room.maxPlayers;
  const actionKey = `join-${room.code}`;
  const pose = roomCardPoseList[index % roomCardPoseList.length];

  return (
    <button
      type="button"
      onClick={() => onJoin(room.code, actionKey)}
      disabled={!isJoinable || Boolean(pendingAction)}
      aria-label={`${room.code} 房间，房主 ${ownerName}，${room.players.length}/${room.maxPlayers}`}
      className="lie-room-card relative isolate flex shrink-0 cursor-pointer flex-col overflow-hidden rounded border-2 border-[#e8ddb7] bg-[#f7f0dc] p-3 text-left text-[#173b2a] shadow-2xl shadow-black/45 outline-none transition-[filter] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[#f0d98d] disabled:cursor-not-allowed disabled:opacity-70"
      style={
        {
          "--room-card-rotate": `${pose.rotate}deg`,
          "--room-card-y": `${pose.y}rem`,
        } as CSSProperties
      }
    >
      <span className="flex h-full w-full flex-col">
        <span className="block max-w-full text-[clamp(1.15rem,2.7vw,1.75rem)] font-black leading-none tracking-[0.02em] text-[#173b2a]">
          {room.code}
        </span>
        <span className="mt-3 flex min-w-0 items-center gap-1.5 text-[0.68rem] font-black tracking-[0.08em] text-[#52605c]">
          <Crown size={13} className="shrink-0" />
          <span className="shrink-0">房主</span>
          <span className="min-w-0 truncate text-sm text-[#173b2a]">{ownerName}</span>
        </span>
        <span className="grid flex-1 place-items-center py-2 text-[clamp(2.4rem,6vw,4rem)] font-black leading-none text-[#b93131]">
          {room.players.length}/{room.maxPlayers}
        </span>
        <span className="mt-auto text-center text-[0.62rem] font-black tracking-[0.14em] text-[#52605c]">
          {pendingAction === actionKey ? "加入中" : isJoinable ? "点击加入" : roomStatusLabelMap[room.status]}
        </span>
      </span>
    </button>
  );
}

function RoomListContent({
  loadingRooms,
  onJoinRoom,
  pendingAction,
  rooms,
}: {
  loadingRooms: boolean;
  onJoinRoom: (roomCode: string, actionKey: string) => void;
  pendingAction: string | null;
  rooms: PublicRoom[];
}) {
  if (loadingRooms) {
    return <RoomSkeletonList />;
  }

  if (rooms.length === 0) {
    return <EmptyRoomCard />;
  }

  return (
    <div className="lie-room-card-hand">
      {rooms.map((room, index) => (
        <RoomCard key={room.id} index={index} room={room} pendingAction={pendingAction} onJoin={onJoinRoom} />
      ))}
    </div>
  );
}

export default function LobbyPage() {
  const router = useRouter();
  const routeLoading = useRouteLoading();
  const [roomCode, setRoomCode] = useState("");
  const [message, setMessage] = useState("");
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [initialRoomsLoaded, setInitialRoomsLoaded] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [refreshingRooms, setRefreshingRooms] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<LobbyModalKind | null>(null);
  const [roomMaxPlayers, setRoomMaxPlayers] = useState<2 | 3 | 4>(4);

  const enterRoom = useCallback(
    (room: PublicRoom) => {
      router.push(`/room/${room.code}?roomId=${room.id}`);
    },
    [router],
  );

  const handleAuthReady = useCallback(() => {
    setAuthReady(true);
  }, []);

  useBodyScrollLock();

  const refreshRoomList = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (!silent) {
      setRefreshingRooms(true);
    }

    try {
      const nextRooms = await fetchRooms();
      setRooms(sortRooms(nextRooms));
    } catch (error) {
      if (!silent) {
        setMessage(error instanceof Error ? error.message : "房间列表加载失败");
      }
    } finally {
      setLoadingRooms(false);
      if (!silent) {
        setInitialRoomsLoaded(true);
      }
      if (!silent) {
        setRefreshingRooms(false);
      }
    }
  }, []);

  useEffect(() => {
    const bootstrapTimer = window.setTimeout(() => {
      void refreshRoomList();
    }, 0);

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void refreshRoomList({ silent: true });
    }, 5000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshRoomList({ silent: true });
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(bootstrapTimer);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshRoomList]);

  useEffect(() => {
    if (authReady && initialRoomsLoaded) {
      routeLoading.complete();
    }
  }, [authReady, initialRoomsLoaded, routeLoading]);

  function closeModal() {
    if (pendingAction) {
      return;
    }

    setActiveModal(null);
  }

  function validateRoomCode() {
    const trimmedRoomCode = roomCode.trim().toUpperCase();

    if (!trimmedRoomCode) {
      return "请输入房间码。";
    }

    if (!/^[A-Z0-9]{4,8}$/.test(trimmedRoomCode)) {
      return "房间码需为 4 到 8 位大写字母或数字。";
    }

    return "";
  }

  async function joinRoomWithCode(nextRoomCode: string, actionKey: string) {
    setPendingAction(actionKey);
    setMessage("");

    try {
      const room = await joinRoom({ roomCode: nextRoomCode.trim().toUpperCase() });
      enterRoom(room);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加入房间失败");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateRoom() {
    setPendingAction("create");
    setMessage("");

    try {
      const room = await createRoom({ maxPlayers: roomMaxPlayers });
      enterRoom(room);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建房间失败");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateRoomCode();

    if (validationError) {
      setMessage(validationError);
      return;
    }

    await joinRoomWithCode(roomCode, "manual-join");
  }

  return (
    <AuthGuard onReady={handleAuthReady}>
      <AppShell edgeToEdge>
        <div className="flex h-dvh max-h-dvh min-h-0 overflow-hidden">
          <section className="min-h-0 min-w-0 flex-1 py-[clamp(0.35rem,1vw,0.85rem)] xl:px-[clamp(0.35rem,1vw,0.85rem)]">
            <div className="flex h-full min-h-0 flex-col px-1 xl:px-0">
              <LobbyHeaderActions
                onBackHome={() => router.push("/")}
                onCreateRoom={() => {
                  setMessage("");
                  setActiveModal("create");
                }}
                onJoinRoom={() => {
                  setMessage("");
                  setActiveModal("join");
                }}
                onRefreshRooms={() => void refreshRoomList()}
                pendingAction={pendingAction}
                refreshingRooms={refreshingRooms}
              />

              <div className="mt-5 min-h-0 flex-1 overflow-y-auto overflow-x-hidden xl:pr-1">
                <RoomListContent
                  loadingRooms={loadingRooms}
                  rooms={rooms}
                  pendingAction={pendingAction}
                  onJoinRoom={(nextRoomCode, actionKey) => void joinRoomWithCode(nextRoomCode, actionKey)}
                />
              </div>
            </div>
          </section>
        </div>

        {activeModal === "create" ? (
          <PixelModal title="创建房间" icon={<Plus size={20} />} onClose={closeModal} closeDisabled={Boolean(pendingAction)}>
            <p className="mt-4 text-sm leading-6 text-[#d6cba6]">系统会自动生成一组六位房间码，建房后直接进入牌桌等待其他玩家。</p>
            <label className="mt-5 block text-sm text-[#e8ddb7]">
              房间人数
              <PixelSelect
                value={String(roomMaxPlayers)}
                onChange={(event) => setRoomMaxPlayers(Number(event.target.value) as 2 | 3 | 4)}
                aria-label="房间人数"
                className="mt-2"
                selectClassName="text-base font-bold tracking-[0.12em]"
              >
                <option value="2">2 人房</option>
                <option value="3">3 人房</option>
                <option value="4">4 人房</option>
              </PixelSelect>
            </label>
            <PixelButton
              onClick={handleCreateRoom}
              disabled={Boolean(pendingAction)}
              variant="primary"
              size="lg"
              fullWidth
              className="mt-6 h-16 text-base"
            >
              <Plus size={22} />
              {pendingAction === "create" ? "正在开桌" : "立即创建"}
            </PixelButton>
          </PixelModal>
        ) : null}

        {activeModal === "join" ? (
          <PixelModal title="加入房间" icon={<Users size={20} />} onClose={closeModal} closeDisabled={Boolean(pendingAction)}>
            <form onSubmit={handleJoinRoom} noValidate className="mt-5">
              <label className="block text-sm text-[#e8ddb7]">
                房间码
                <PixelInput
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                  maxLength={8}
                  aria-label="房间码"
                  icon={<Swords size={18} />}
                  className="mt-2"
                  inputClassName="text-lg font-bold uppercase tracking-[0.24em]"
                />
              </label>
              <PixelButton
                type="submit"
                disabled={Boolean(pendingAction)}
                variant="ghost"
                fullWidth
                className="mt-5 h-12"
              >
                <Users size={17} />
                {pendingAction === "manual-join" ? "正在加入" : "输入房间码加入"}
              </PixelButton>
            </form>
          </PixelModal>
        ) : null}

        {message ? <PixelMessage>{message}</PixelMessage> : null}
      </AppShell>
    </AuthGuard>
  );
}
