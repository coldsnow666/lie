/**
 * 房间页面：等待房间和游戏桌面的统一入口，负责展示房间和对局状态。
 */
"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import AuthGuard from "@/components/auth/AuthGuard";
import GameTable from "@/components/game/GameTable";
import AppShell from "@/components/layout/AppShell";
import WaitingRoomBoard from "@/components/room/WaitingRoomBoard";
import { useRoomSession } from "@/hooks/useRoomSession";
import PixelMessage from "@/components/ui/PixelMessage";

export default function RoomPage() {
  const router = useRouter();
  const params = useParams<{ roomCode: string }>();
  const searchParams = useSearchParams();
  const roomCode = params.roomCode?.toUpperCase();
  const {
    session: { roomId, room, gameState, events, message, busy, selfPlayer, isOwner, canStart },
    selection: { selectedCardIds, setDeclaredRank, toggleCard, setCardSelected },
    actions: { leave, ready, startGame, playCards, challenge },
  } = useRoomSession({
    roomCode,
    fallbackRoomId: searchParams.get("roomId"),
  });

  async function handleLeave() {
    if (!roomId) {
      router.push("/lobby");
      return;
    }

    if (await leave()) {
      router.push("/lobby");
    }
  }

  return (
    <AuthGuard>
      <AppShell edgeToEdge>
        {!roomId ? (
          <PixelMessage>缺少房间 ID，请从大厅重新加入。</PixelMessage>
        ) : null}

        {message ? <PixelMessage>{message}</PixelMessage> : null}

        {gameState ? (
          <GameTable
            state={gameState}
            selectedCardIds={selectedCardIds}
            ownerUserId={room?.ownerUserId ?? null}
            selfPlayerId={selfPlayer?.playerId ?? null}
            onDeclaredRankChange={setDeclaredRank}
            onToggleCard={toggleCard}
            onSetCardSelected={setCardSelected}
            onPlayCards={playCards}
            onChallenge={challenge}
            busy={busy}
          />
        ) : (
          <WaitingRoomBoard
            busy={busy}
            canStart={canStart}
            events={events}
            isOwner={isOwner}
            onCopyRoomCode={() => navigator.clipboard?.writeText(room?.code ?? roomCode)}
            onLeave={() => void handleLeave()}
            onReady={() => void ready()}
            onStartGame={() => void startGame()}
            room={room}
            roomCode={roomCode}
            selfPlayer={selfPlayer}
          />
        )}
      </AppShell>
    </AuthGuard>
  );
}
