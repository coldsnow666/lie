/**
 * @Description: 大厅房间数据 Hook：统一管理房间列表订阅、兜底刷新和错误状态。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/features/auth/SessionProvider";
import { showPixelMessage } from "@/components/ui/PixelMessage";
import { createSocket, emitWithAck } from "@/lib/socket";
import { fetchRooms, type PublicRoom } from "@/service/modules/game";

type LobbyRoomsPayload = {
  rooms: PublicRoom[];
};

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

export function useLobbyRooms() {
  const { status } = useSession();
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [refreshingRooms, setRefreshingRooms] = useState(false);
  const [initialRoomsLoaded, setInitialRoomsLoaded] = useState(false);

  const applyRooms = useCallback((nextRooms: PublicRoom[]) => {
    setRooms(sortRooms(nextRooms));
    setLoadingRooms(false);
    setInitialRoomsLoaded(true);
  }, []);

  const refreshRoomList = useCallback(
    async (options?: { markReady?: boolean; silent?: boolean }) => {
      const markReady = options?.markReady ?? true;
      const silent = options?.silent ?? false;

      if (!silent) {
        setRefreshingRooms(true);
      }

      try {
        applyRooms(await fetchRooms());
      } catch (error) {
        if (!silent) {
          showPixelMessage(error instanceof Error ? error.message : "房间列表加载失败");
        }
      } finally {
        setLoadingRooms(false);
        if (markReady) {
          setInitialRoomsLoaded(true);
        }
        if (!silent) {
          setRefreshingRooms(false);
        }
      }
    },
    [applyRooms],
  );

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    const socket = createSocket();
    let active = true;

    function handleLobbyRoomsUpdated(nextRooms: PublicRoom[]) {
      if (!active) {
        return;
      }

      applyRooms(nextRooms);
    }

    async function subscribeLobbyRooms() {
      try {
        const data = await emitWithAck<LobbyRoomsPayload>("lobby:subscribe", {});
        handleLobbyRoomsUpdated(data.rooms);
      } catch {
        if (active) {
          void refreshRoomList();
        }
      }
    }

    function handleConnect() {
      void subscribeLobbyRooms();
    }

    socket.on("connect", handleConnect);
    socket.on("lobby:roomsUpdated", handleLobbyRoomsUpdated);

    if (socket.connected) {
      void subscribeLobbyRooms();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshRoomList({ silent: true });
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      socket.off("connect", handleConnect);
      socket.off("lobby:roomsUpdated", handleLobbyRoomsUpdated);
      socket.emit("lobby:unsubscribe", {});
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [applyRooms, refreshRoomList, status]);

  return {
    rooms,
    loadingRooms,
    refreshingRooms,
    initialRoomsLoaded,
    refreshRoomList,
  };
}
