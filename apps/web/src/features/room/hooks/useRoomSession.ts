/**
 * @Description: 房间会话组合 Hook，统一收口房间同步状态、选牌状态和房间动作。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import { useCallback, useMemo, useState } from "react";
import { DECLARABLE_RANKS, type DeclaredRank } from "@lie/shared";
import { useSession } from "@/features/auth/SessionProvider";
import { disconnectSocket, emitWithAck } from "@/lib/socket";
import { showPixelMessage } from "@/components/ui/PixelMessage";
import { useRoomExitGuard } from "@/features/room/hooks/useRoomExitGuard";
import { useRoomSyncState } from "@/features/room/hooks/useRoomSyncState";
import { useSelectedCards } from "@/features/room/hooks/useSelectedCards";
import {
  leaveRoomByHttp,
  type PublicRoomPlayer,
  type RoomSyncPayload,
} from "@/service/modules/game";

/**
 * @Description: 组合房间页状态、选牌状态和所有房间动作，作为 RoomView 的业务门面。
 *
 * @param fallbackRoomId 路由或上游传入的房间 ID 兜底值。
 * @param roomCode 当前路由中的房间码。
 * @return 页面会话状态、选牌状态和房间动作集合。
 *
 * @Date 2026-06-12 14:47
 */
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
      showPixelMessage(error instanceof Error ? error.message : "离开房间失败");
      return false;
    } finally {
      setBusy(false);
    }
  }, [markRoomLeft, roomId]);

  const ready = useCallback(async () => {
    if (!roomId || !selfPlayer || isOwner) {
      return;
    }

    setBusy(true);
    try {
      await emitWithAck("room:ready", { roomId, ready: !selfPlayer.ready });
    } catch (error) {
      showPixelMessage(error instanceof Error ? error.message : "准备状态更新失败");
    } finally {
      setBusy(false);
    }
  }, [isOwner, roomId, selfPlayer]);

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
      showPixelMessage(error instanceof Error ? error.message : "开始游戏失败");
    } finally {
      setBusy(false);
    }
  }, [applyRoomSyncPayload, roomId, syncRoom]);

  const playCards = useCallback(async (declaredRankOverride?: DeclaredRank, orderedCardIds?: string[]) => {
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
      const followingDeclaredRank = Boolean(gameState?.lastPlay);

      // 上一手玩家已经出完牌时，主按钮代表“不质疑并确认胜利”，协议层用空 cardIds 表达这个选择。
      await emitWithAck("game:playCards", {
        roomId,
        cardIds: resolvingPendingWin ? [] : (orderedCardIds ?? selectedCardIds),
        declaredRank: resolvingPendingWin || followingDeclaredRank ? undefined : (declaredRankOverride ?? declaredRank),
      });
      clearSelectedCards();
    } catch (error) {
      showPixelMessage(error instanceof Error ? error.message : "出牌失败");
    } finally {
      setBusy(false);
    }
  }, [clearSelectedCards, declaredRank, gameState, roomId, selectedCardIds, selfPlayer]);

  const challenge = useCallback(async () => {
    if (!roomId) {
      return;
    }

    setBusy(true);
    try {
      await emitWithAck("game:challenge", { roomId });
    } catch (error) {
      showPixelMessage(error instanceof Error ? error.message : "质疑失败");
    } finally {
      setBusy(false);
    }
  }, [roomId]);

  return {
    session: {
      roomId,
      room,
      gameState,
      events,
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
      leave,
      ready,
      startGame,
      playCards,
      challenge,
    },
  };
}
