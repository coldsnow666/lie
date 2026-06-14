/**
 * @Description: 等待房间中的玩家卡片，负责展示房主、准备和在线状态。
 *
 * @Date 2026-06-12 14:47
 */
import { type CSSProperties } from "react";
import { type Card } from "@lie/shared";
import DomPlayingCard from "@/components/cards/DomPlayingCard";
import { type PublicRoomPlayer } from "@/service/modules/game";

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

function hashText(value: string) {
  return Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
}

function waitingCardForPlayer(player: PublicRoomPlayer) {
  return WAITING_CARD_POOL[hashText(player.playerId) % WAITING_CARD_POOL.length];
}

export default function WaitingPlayerCard({
  ownerUserId,
  player,
  slotIndex,
}: {
  ownerUserId: string | null;
  player: PublicRoomPlayer | null;
  slotIndex: number;
}) {
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
            <div
              className={
                player.connected
                  ? "mt-0.5 text-[0.58rem] font-black leading-none text-emerald-700"
                  : "mt-0.5 text-[0.58rem] font-black leading-none text-red-700"
              }
            >
              {player.connected ? "在线" : "离线"}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
