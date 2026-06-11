/**
 * 文件说明：等待房间桌面，负责展示房间码、玩家卡片和等待中的事件日志。
 */
import { Copy, ScrollText } from "lucide-react";
import type { PublicGameEvent } from "@lie/shared";
import { formatGameEvent } from "@/components/game/formatGameEvent";
import PixelButton from "@/components/ui/PixelButton";
import { type PublicRoom, type PublicRoomPlayer } from "@/service/modules/game";
import WaitingPlayerCard from "./WaitingPlayerCard";
import WaitingRoomActions from "./WaitingRoomActions";

export default function WaitingRoomBoard({
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
  onCopyRoomCode: () => void | Promise<void>;
  onLeave: () => void;
  onReady: () => void;
  onStartGame: () => void;
  room: PublicRoom | null;
  roomCode?: string;
  selfPlayer: PublicRoomPlayer | null;
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
            <PixelButton onClick={() => void onCopyRoomCode()} variant="ghost" size="sm" className="h-8 px-3 text-xs sm:h-10 sm:px-4">
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
                  {formatGameEvent(event)}
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
