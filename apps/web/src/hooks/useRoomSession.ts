/**
 * 文件说明：房间会话组合 Hook，统一收口房间同步状态、选牌状态和房间动作。
 */
"use client";

import { useCallback, useMemo, useState } from "react";
import { DECLARABLE_RANKS, type DeclaredRank } from "@lie/shared";
import { useSession } from "@/components/auth/SessionProvider";
import { disconnectSocket, emitWithAck } from "@/lib/socket";
import { useRoomExitGuard } from "@/hooks/room/useRoomExitGuard";
import { useRoomSyncState } from "@/hooks/room/useRoomSyncState";
import { useSelectedCards } from "@/hooks/room/useSelectedCards";
import {
  leaveRoomByHttp,
  type PublicRoomPlayer,
  type RoomSyncPayload,
} from "@/service/modules/game";

export function useRoomSession({
  fallbackRoomId,
  roomCode,
}: {
  fallbackRoomId: string | null;
  roomCode?: string;
}) {
  const { user } = useSession();
  const [declaredRank, setDeclaredRank] = useState<DeclaredRank>(DECLARABLE_RANKS[0]);
  const [busy, setBusy] = useState(false);
  const { selectedCardIds, clearSelectedCards, reconcileSelectedCards, toggleCard, setCardSelected } = useSelectedCards();
  const {
    roomId,
    room,
    gameState,
    events,
    message,
    setMessage,
    syncRoom,
    applyRoomSyncPayload,
  } = useRoomSyncState({
    fallbackRoomId,
    roomCode,
    userId: user?.id,
    clearSelectedCards,
    reconcileSelectedCards,
  });
  const { markRoomLeft } = useRoomExitGuard({
    roomId,
    enabled: Boolean(user?.id),
  });

  const selfPlayer = useMemo(
    () => room?.players.find((player) => player.userId === user?.id) ?? null,
    [room, user],
  );
  const isOwner = Boolean(room?.ownerUserId && room.ownerUserId === user?.id);
  const canStart = Boolean(isOwner && room && room.players.length === room.maxPlayers && room.status === "waiting");

  const leave = useCallback(async () => {
    if (!roomId) {
      return false;
    }

    setBusy(true);
    try {
      markRoomLeft();
      try {
        await emitWithAck("room:leave", { roomId });
      } catch {
        await leaveRoomByHttp(roomId);
      }
      disconnectSocket();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "离开房间失败");
      return false;
    } finally {
      setBusy(false);
    }
  }, [markRoomLeft, roomId, setMessage]);

  const ready = useCallback(async () => {
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
  }, [isOwner, roomId, selfPlayer, setMessage]);

  const startGame = useCallback(async () => {
    if (!roomId) {
      return;
    }

    setBusy(true);
    try {
      const data = await emitWithAck<RoomSyncPayload>("game:start", { roomId });
      applyRoomSyncPayload(data);
      await syncRoom();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "开始游戏失败");
    } finally {
      setBusy(false);
    }
  }, [applyRoomSyncPayload, roomId, setMessage, syncRoom]);

  const playCards = useCallback(async (declaredRankOverride?: DeclaredRank) => {
    if (!roomId) {
      return;
    }

    setBusy(true);
    try {
      const pendingWinnerPlayerId = gameState?.players.find((player) => player.pendingWin)?.playerId ?? null;
      const resolvingPendingWin =
        Boolean(gameState?.lastPlay) &&
        Boolean(pendingWinnerPlayerId) &&
        pendingWinnerPlayerId !== selfPlayer?.playerId;

      await emitWithAck("game:playCards", {
        roomId,
        cardIds: resolvingPendingWin ? [] : selectedCardIds,
        declaredRank: resolvingPendingWin ? undefined : (declaredRankOverride ?? declaredRank),
      });
      clearSelectedCards();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "出牌失败");
    } finally {
      setBusy(false);
    }
  }, [clearSelectedCards, declaredRank, gameState, roomId, selectedCardIds, selfPlayer, setMessage]);

  const challenge = useCallback(async () => {
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
  }, [roomId, setMessage]);

  return {
    session: {
      roomId,
      room,
      gameState,
      events,
      message,
      busy,
      user,
      selfPlayer: selfPlayer as PublicRoomPlayer | null,
      isOwner,
      canStart,
    },
    selection: {
      selectedCardIds,
      declaredRank,
      setDeclaredRank,
      toggleCard,
      setCardSelected,
    },
    actions: {
      setMessage,
      leave,
      ready,
      startGame,
      playCards,
      challenge,
    },
  };
}
