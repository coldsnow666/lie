/**
 * 大厅页面：左侧展示大厅概览，右侧展示房间列表与房间操作入口。
 */
"use client";

import { useRouter } from "next/navigation";
import { FormEvent, type CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { Crown, House, Plus, RefreshCw, Swords, Users } from "lucide-react";
import AuthGuard from "@/components/auth/AuthGuard";
import AppShell from "@/components/layout/AppShell";
import PixelButton from "@/components/ui/PixelButton";
import PixelInput from "@/components/ui/PixelInput";
import PixelMessage from "@/components/ui/PixelMessage";
import PixelModal from "@/components/ui/PixelModal";
import PixelPanel from "@/components/ui/PixelPanel";
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

export default function LobbyPage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [message, setMessage] = useState("");
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [refreshingRooms, setRefreshingRooms] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<LobbyModalKind | null>(null);

  const roomSummary = useMemo(() => {
    return {
      waiting: rooms.filter((room) => room.status === "waiting").length,
      playing: rooms.filter((room) => room.status === "playing").length,
      finished: rooms.filter((room) => room.status === "finished").length,
    };
  }, [rooms]);

  const enterRoom = useCallback(
    (room: PublicRoom) => {
      router.push(`/room/${room.code}?roomId=${room.id}`);
    },
    [router],
  );

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
        setRefreshingRooms(false);
      }
    }
  }, []);

  useEffect(() => {
    const bootstrapTimer = window.setTimeout(() => {
      void refreshRoomList();
    }, 0);

    const timer = window.setInterval(() => {
      void refreshRoomList({ silent: true });
    }, 5000);

    return () => {
      window.clearTimeout(bootstrapTimer);
      window.clearInterval(timer);
    };
  }, [refreshRoomList]);

  useEffect(() => {
    if (!activeModal) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pendingAction) {
        setActiveModal(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeModal, pendingAction]);

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
      const room = await createRoom();
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
    <AuthGuard>
      <AppShell fullBleed>
        <div className="grid min-h-[calc(100dvh-1rem)] gap-[clamp(0.35rem,0.9vw,0.75rem)] xl:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="grid content-start gap-3 overflow-hidden bg-[#142523]/92 p-[clamp(0.55rem,1vw,0.85rem)] xl:min-h-[calc(100dvh-1rem)]">
            <section className="px-1 py-1">
              <div>
                <h1 className="mt-2 text-2xl font-black text-[#fff6cf]">大厅导航</h1>
                <p className="mt-3 text-sm leading-6 text-[#c6b889]">回到启动页，或者从这里快速查看当前可开的桌数和大厅热度。</p>
              </div>

              <PixelButton onClick={() => router.push("/")} variant="accent" size="sm" fullWidth className="mt-4 h-11">
                <House size={16} />
                返回首页
              </PixelButton>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="px-1 py-2">
                  <p className="text-[0.65rem] tracking-[0.16em] text-[#9cb6a7]">开放</p>
                  <p className="mt-2 text-2xl font-black text-[#fff6cf]">{roomSummary.waiting}</p>
                </div>
                <div className="px-1 py-2">
                  <p className="text-[0.65rem] tracking-[0.16em] text-[#9cb6a7]">对局</p>
                  <p className="mt-2 text-2xl font-black text-[#9df7df]">{roomSummary.playing}</p>
                </div>
                <div className="px-1 py-2">
                  <p className="text-[0.65rem] tracking-[0.16em] text-[#9cb6a7]">总数</p>
                  <p className="mt-2 text-2xl font-black text-[#ffdd84]">{rooms.length}</p>
                </div>
              </div>
            </section>
          </aside>

          <section className="min-w-0 px-[clamp(0.35rem,1vw,0.85rem)] py-[clamp(0.35rem,1vw,0.85rem)]">
            <div className="min-h-[calc(100dvh-1rem)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="mt-2 text-2xl font-black text-[#fff6cf]">房间列表</h2>
                  <p className="mt-2 text-sm text-[#c6b889]">右侧展示当前大厅中的公开房间，点击即可快速加入等待中的桌子。</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PixelButton
                    onClick={() => {
                      setMessage("");
                      setActiveModal("create");
                    }}
                    disabled={Boolean(pendingAction)}
                    variant="primary"
                    size="sm"
                  >
                    <Plus size={16} />
                    创建房间
                  </PixelButton>
                  <PixelButton
                    onClick={() => {
                      setMessage("");
                      setActiveModal("join");
                    }}
                    disabled={Boolean(pendingAction)}
                    variant="ghost"
                    size="sm"
                  >
                    <Users size={16} />
                    加入房间
                  </PixelButton>
                  <PixelButton
                    onClick={() => void refreshRoomList()}
                    disabled={refreshingRooms}
                    variant="secondary"
                    size="sm"
                  >
                    <RefreshCw size={16} className={refreshingRooms ? "animate-spin" : ""} />
                    {refreshingRooms ? "刷新中" : "刷新列表"}
                  </PixelButton>
                </div>
              </div>

              {loadingRooms ? (
                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <PixelPanel key={`room-skeleton-${index}`} tone="dark" padding="md" className="min-h-44 animate-pulse">
                      <div className="h-6 w-24 rounded bg-white/8" />
                      <div className="mt-4 h-4 w-36 rounded bg-white/6" />
                      <div className="mt-3 h-4 w-28 rounded bg-white/6" />
                      <div className="mt-8 h-11 w-full rounded bg-white/7" />
                    </PixelPanel>
                  ))}
                </div>
              ) : rooms.length === 0 ? (
                <PixelPanel tone="dark" padding="lg" className="mt-5 min-h-72">
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <Swords size={38} className="text-[#d7bc72]" />
                    <h3 className="mt-4 text-xl font-black text-[#fff6cf]">当前还没有公开房间</h3>
                    <p className="mt-3 max-w-md text-sm leading-6 text-[#c6b889]">
                      现在开一桌会直接出现在列表里。你也可以把房间码发给朋友，让他们通过顶部按钮快速加入。
                    </p>
                  </div>
                </PixelPanel>
              ) : (
                <div className="lie-room-card-hand mt-6">
                  {rooms.map((room, index) => {
                    const ownerName = resolveOwnerName(room);
                    const isJoinable = room.status === "waiting" && room.players.length < room.maxPlayers;
                    const actionKey = `join-${room.code}`;
                    const pose = roomCardPoseList[index % roomCardPoseList.length];

                    return (
                      <button
                        type="button"
                        key={room.id}
                        onClick={() => void joinRoomWithCode(room.code, actionKey)}
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
                          <span className="mt-3 flex items-center gap-1.5 text-[0.68rem] font-black tracking-[0.1em] text-[#52605c]">
                            <Crown size={13} />
                            房主
                          </span>
                          <span className="mt-1 truncate text-sm font-black text-[#173b2a]">{ownerName}</span>
                          <span className="grid flex-1 place-items-center py-2 text-[clamp(2.4rem,6vw,4rem)] font-black leading-none text-[#b93131]">
                            {room.players.length}/{room.maxPlayers}
                          </span>
                          <span className="mt-auto text-center text-[0.62rem] font-black tracking-[0.14em] text-[#52605c]">
                            {pendingAction === actionKey ? "加入中" : isJoinable ? "点击加入" : roomStatusLabelMap[room.status]}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        {activeModal === "create" ? (
          <PixelModal title="创建房间" icon={<Plus size={20} />} onClose={closeModal}>
            <p className="mt-4 text-sm leading-6 text-[#d6cba6]">系统会自动生成一组六位房间码，建房后直接进入牌桌等待其他玩家。</p>
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
          <PixelModal title="加入房间" icon={<Users size={20} />} onClose={closeModal}>
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
