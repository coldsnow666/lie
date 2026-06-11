/**
 * 文件说明：集中管理房间同步、Socket 订阅和页面重新可见后的状态刷新。
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicGameEvent, PublicGameState } from "@lie/shared";
import { createSocket, emitWithAck } from "@/lib/socket";
import {
  joinRoom,
  type PublicRoom,
  type RoomSyncPayload,
} from "@/service/modules/game";

export function useRoomSyncState({
  fallbackRoomId,
  roomCode,
  userId,
  clearSelectedCards,
  reconcileSelectedCards,
}: {
  fallbackRoomId: string | null;
  roomCode?: string;
  userId?: string;
  clearSelectedCards: () => void;
  reconcileSelectedCards: (nextState: PublicGameState) => void;
}) {
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [gameState, setGameState] = useState<PublicGameState | null>(null);
  const [events, setEvents] = useState<PublicGameEvent[]>([]);
  const [message, setMessage] = useState("");
  const roomId = room?.id ?? fallbackRoomId;

  const applyRoomSyncPayload = useCallback(
    (data: RoomSyncPayload) => {
      setRoom(data.room);
      setEvents(data.room.events ?? []);

      if (data.gameState) {
        setGameState(data.gameState);
        reconcileSelectedCards(data.gameState);
        return;
      }

      setGameState(null);
      clearSelectedCards();
    },
    [clearSelectedCards, reconcileSelectedCards],
  );

  const syncRoom = useCallback(async () => {
    if (!roomId || !userId) {
      return;
    }

    try {
      const data = await emitWithAck<RoomSyncPayload>("game:sync", { roomId });
      applyRoomSyncPayload(data);
      setMessage("");
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "同步房间失败";

      if (nextMessage === "你不在这个房间" && roomCode) {
        try {
          const joinedRoom = await joinRoom({ roomCode });
          const fallbackData = await emitWithAck<RoomSyncPayload>("game:sync", { roomId: joinedRoom.id });
          applyRoomSyncPayload(fallbackData);
          setMessage("");
          return;
        } catch (fallbackError) {
          setMessage(fallbackError instanceof Error ? fallbackError.message : nextMessage);
          return;
        }
      }

      setMessage(nextMessage);
    }
  }, [applyRoomSyncPayload, roomCode, roomId, userId]);

  useEffect(() => {
    if (!roomId || !userId) {
      return;
    }

    const socket = createSocket();

    function handleRoomUpdated(nextRoom: PublicRoom) {
      if (nextRoom.id !== roomId) {
        return;
      }

      setRoom(nextRoom);
      setEvents(nextRoom.events ?? []);
    }

    function handleGameUpdated(nextState: PublicGameState) {
      if (nextState.roomId !== roomId) {
        return;
      }

      setGameState(nextState);
      reconcileSelectedCards(nextState);
    }

    function handleGameEvent(event: PublicGameEvent) {
      setEvents((current) => [...current.slice(-29), event]);
    }

    function handleConnect() {
      void syncRoom();
    }

    socket.on("connect", handleConnect);
    socket.on("room:updated", handleRoomUpdated);
    socket.on("game:updated", handleGameUpdated);
    socket.on("game:event", handleGameEvent);
    socket.on("game:challengeResolved", handleGameEvent);

    const initialSyncTimer = window.setTimeout(() => {
      void syncRoom();
    }, 0);

    return () => {
      window.clearTimeout(initialSyncTimer);
      socket.off("connect", handleConnect);
      socket.off("room:updated", handleRoomUpdated);
      socket.off("game:updated", handleGameUpdated);
      socket.off("game:event", handleGameEvent);
      socket.off("game:challengeResolved", handleGameEvent);
    };
  }, [reconcileSelectedCards, roomId, syncRoom, userId]);

  useEffect(() => {
    if (!roomId || !userId) {
      return;
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void syncRoom();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [roomId, syncRoom, userId]);

  return {
    roomId,
    room,
    gameState,
    events,
    message,
    setMessage,
    syncRoom,
    applyRoomSyncPayload,
  };
}
