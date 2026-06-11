/**
 * 文件说明：处理房间页的离场补偿逻辑，避免路由切换和页面关闭时重复退房。
 */
"use client";

import { useCallback, useEffect, useRef } from "react";
import { disconnectSocket, getSocket } from "@/lib/socket";
import { leaveRoomOnPageExit } from "@/service/modules/game";

const routeExitLeaveTimers = new Map<string, number>();

function cancelRouteExitLeave(roomId: string) {
  const timer = routeExitLeaveTimers.get(roomId);
  if (!timer) {
    return;
  }

  window.clearTimeout(timer);
  routeExitLeaveTimers.delete(roomId);
}

function scheduleRouteExitLeave(roomId: string, leaveOnExit: () => void) {
  cancelRouteExitLeave(roomId);

  const timer = window.setTimeout(() => {
    routeExitLeaveTimers.delete(roomId);
    leaveOnExit();
  }, 300);

  routeExitLeaveTimers.set(roomId, timer);
}

export function useRoomExitGuard({
  roomId,
  enabled,
}: {
  roomId: string | null;
  enabled: boolean;
}) {
  const exitLeaveSentRef = useRef(false);

  const markRoomLeft = useCallback(() => {
    exitLeaveSentRef.current = true;
  }, []);

  useEffect(() => {
    if (!roomId || !enabled) {
      return;
    }

    const activeRoomId = roomId;
    exitLeaveSentRef.current = false;
    cancelRouteExitLeave(activeRoomId);

    function leaveOnExit() {
      if (exitLeaveSentRef.current) {
        return;
      }

      exitLeaveSentRef.current = true;
      getSocket()?.emit("room:leave", { roomId: activeRoomId });
      leaveRoomOnPageExit(activeRoomId);
      disconnectSocket();
    }

    window.addEventListener("pagehide", leaveOnExit);

    return () => {
      window.removeEventListener("pagehide", leaveOnExit);
      scheduleRouteExitLeave(activeRoomId, leaveOnExit);
    };
  }, [enabled, roomId]);

  return {
    markRoomLeft,
  };
}
