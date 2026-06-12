/**
 * @Description: 处理房间页的离场补偿逻辑，避免路由切换和页面关闭时重复退房。
 *
 * @Date 2026-06-12 14:47
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

/**
 * @Description: 安排路由切换后的延迟退房，让快速重进同一房间有机会取消离场补偿。
 *
 * @param roomId 当前房间 ID。
 * @param leaveOnExit 真正执行的离场补偿函数。
 * @return 无。
 *
 * @Date 2026-06-12 14:47
 */
function scheduleRouteExitLeave(roomId: string, leaveOnExit: () => void) {
  cancelRouteExitLeave(roomId);

  const timer = window.setTimeout(() => {
    routeExitLeaveTimers.delete(roomId);
    leaveOnExit();
  }, 300);

  routeExitLeaveTimers.set(roomId, timer);
}

/**
 * @Description: 在页面关闭或路由离开时发送退房补偿，并防止显式离开与卸载事件重复提交。
 *
 * @param roomId 当前房间 ID。
 * @param enabled 当前用户是否允许触发离场补偿。
 * @return 标记已主动离房的方法。
 *
 * @Date 2026-06-12 14:47
 */
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
