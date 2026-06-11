/**
 * 大厅页面：左侧展示大厅概览，右侧展示房间列表与房间操作入口。
 */
"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Plus, Swords, Users } from "lucide-react";
import { useSession } from "@/components/auth/SessionProvider";
import AuthGuard from "@/components/auth/AuthGuard";
import AppShell from "@/components/layout/AppShell";
import LobbyHeaderActions from "@/components/lobby/LobbyHeaderActions";
import { useRouteLoading } from "@/components/loading/RouteLoadingProvider";
import RoomListContent from "@/components/lobby/RoomListContent";
import { useLobbyRooms } from "@/hooks/useLobbyRooms";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import PixelButton from "@/components/ui/PixelButton";
import PixelInput from "@/components/ui/PixelInput";
import PixelMessage from "@/components/ui/PixelMessage";
import PixelModal from "@/components/ui/PixelModal";
import PixelSelect from "@/components/ui/PixelSelect";
import { normalizeRoomCode, validateRoomCode } from "@/lib/room-code";
import { createRoom, joinRoom, type PublicRoom } from "@/service/modules/game";

type LobbyModalKind = "create" | "join";

export default function LobbyPage() {
  const router = useRouter();
  const { status } = useSession();
  const routeLoading = useRouteLoading();
  const [roomCode, setRoomCode] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<LobbyModalKind | null>(null);
  const [roomMaxPlayers, setRoomMaxPlayers] = useState<2 | 3>(3);
  const { rooms, loadingRooms, refreshingRooms, initialRoomsLoaded, message, setMessage, refreshRoomList } =
    useLobbyRooms();

  useBodyScrollLock();

  useEffect(() => {
    if (status === "authenticated" && initialRoomsLoaded) {
      routeLoading.complete();
    }
  }, [initialRoomsLoaded, routeLoading, status]);

  function enterRoom(room: PublicRoom) {
    router.push(`/room/${room.code}?roomId=${room.id}`);
  }

  function closeModal() {
    if (pendingAction) {
      return;
    }

    setActiveModal(null);
  }

  async function joinRoomWithCode(nextRoomCode: string, actionKey: string) {
    setPendingAction(actionKey);
    setMessage("");

    try {
      const room = await joinRoom({ roomCode: normalizeRoomCode(nextRoomCode) });
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
    const validationError = validateRoomCode(roomCode);

    if (validationError) {
      setMessage(validationError);
      return;
    }

    await joinRoomWithCode(roomCode, "manual-join");
  }

  return (
    <AuthGuard>
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
                onChange={(event) => setRoomMaxPlayers(Number(event.target.value) as 2 | 3)}
                aria-label="房间人数"
                className="mt-2"
                selectClassName="text-base font-bold tracking-[0.12em]"
              >
                <option value="2">2 人房</option>
                <option value="3">3 人房</option>
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
                  onChange={(event) => setRoomCode(normalizeRoomCode(event.target.value))}
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
