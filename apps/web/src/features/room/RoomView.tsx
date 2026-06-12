/**
 * @Description: 房间业务视图，按同步状态切换等待房间和正式牌桌。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/features/auth/AuthGuard";
import AppShell from "@/components/layout/AppShell";
import { useRouteLoading } from "@/components/loading/RouteLoadingProvider";
import { showPixelMessage } from "@/components/ui/PixelMessage";
import GameTable from "@/features/game/GameTable";
import { useBodyScrollLock } from "@/hooks/useScrollLock";
import WaitingRoomBoard from "./WaitingRoomBoard";
import { useRoomSession } from "./hooks/useRoomSession";

export default function RoomView({
  fallbackRoomId,
  roomCode,
}: {
  fallbackRoomId: string | null;
  roomCode?: string;
}) {
  const router = useRouter();
  const routeLoading = useRouteLoading();

  useBodyScrollLock();

  const {
    session: { roomId, room, gameState, events, busy, selfPlayer, isOwner, canStart },
    selection: { selectedCardIds, setDeclaredRank, toggleCard, setCardSelected },
    actions: { leave, ready, startGame, playCards, challenge },
  } = useRoomSession({
    roomCode,
    fallbackRoomId,
  });

  useEffect(() => {
    if (!roomId) {
      routeLoading.cancel();
      showPixelMessage("缺少房间 ID，请从大厅重新加入。");
    }
  }, [roomId, routeLoading]);

  useEffect(() => {
    if (room || gameState) {
      routeLoading.complete();
    }
  }, [gameState, room, routeLoading]);

  useEffect(() => {
    document.body.dataset.lieBackgroundMode = gameState ? "game" : "room";

    return () => {
      delete document.body.dataset.lieBackgroundMode;
    };
  }, [gameState]);

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
        {gameState ? (
          <section className="h-dvh max-h-dvh overflow-y-hidden overflow-x-clip">
            <GameTable
              state={gameState}
              events={events}
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
          </section>
        ) : (
          <WaitingRoomBoard
            busy={busy}
            canStart={canStart}
            events={events}
            isOwner={isOwner}
            onCopyRoomCode={() => navigator.clipboard?.writeText(room?.code ?? roomCode ?? "")}
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
