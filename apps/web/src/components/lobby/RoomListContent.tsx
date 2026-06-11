/**
 * 文件说明：大厅房间列表区域，统一收口空态、骨架屏和房间卡片展示。
 */
import { type CSSProperties, useState } from "react";
import { Crown } from "lucide-react";
import CardBackArt from "@/components/game/CardBackArt";
import DomPlayingCard from "@/components/game/DomPlayingCard";
import PixelPanel from "@/components/ui/PixelPanel";
import { type PublicRoom } from "@/service/modules/game";

const roomStatusLabelMap: Record<PublicRoom["status"], string> = {
  waiting: "等待中",
  playing: "对局中",
  finished: "已结束",
};

const roomCardPoseList = [
  { rotate: -8, y: 0.45 },
  { rotate: -4, y: 0.1 },
  { rotate: 0, y: -0.08 },
  { rotate: 4, y: 0.1 },
  { rotate: 8, y: 0.45 },
  { rotate: -5, y: 0.25 },
];

function resolveOwnerName(room: PublicRoom) {
  const owner = room.players.find((player) => player.userId === room.ownerUserId);
  return owner?.nickname ?? room.players[0]?.nickname ?? "未知房主";
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

export default function RoomListContent({
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
