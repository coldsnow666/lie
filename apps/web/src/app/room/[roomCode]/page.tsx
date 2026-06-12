/**
 * @Description: 房间页面：解析路由参数并挂载房间 feature 业务视图。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import { useParams, useSearchParams } from "next/navigation";
import RoomView from "@/features/room/RoomView";

export default function RoomPage() {
  const params = useParams<{ roomCode: string }>();
  const searchParams = useSearchParams();
  const roomCode = params.roomCode?.toUpperCase();

  return <RoomView roomCode={roomCode} fallbackRoomId={searchParams.get("roomId")} />;
}
