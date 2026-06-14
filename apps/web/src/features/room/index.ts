/**
 * @Description: 房间 feature 的公开出口。
 *
 * @Date 2026-06-12 14:47
 */
export { default as RoomView } from "./components/RoomView";
export { default as WaitingPlayerCard } from "./components/WaitingPlayerCard";
export { default as WaitingRoomActions } from "./components/WaitingRoomActions";
export { default as WaitingRoomBoard } from "./components/WaitingRoomBoard";
export { useRoomExitGuard } from "./hooks/useRoomExitGuard";
export { useRoomSession } from "./hooks/useRoomSession";
export { useRoomSyncState } from "./hooks/useRoomSyncState";
export { useSelectedCards } from "./hooks/useSelectedCards";
