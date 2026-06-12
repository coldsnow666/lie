/**
 * @Description: 大厅顶部操作栏，负责返回、创建房间、加入房间和刷新列表入口。
 *
 * @Date 2026-06-12 14:47
 */
import { ArrowLeft, RefreshCw } from "lucide-react";
import PixelButton from "@/components/ui/PixelButton";

export default function LobbyHeaderActions({
  onBackHome,
  onCreateRoom,
  onJoinRoom,
  onRefreshRooms,
  pendingAction,
  refreshingRooms,
}: {
  onBackHome: () => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onRefreshRooms: () => void;
  pendingAction: string | null;
  refreshingRooms: boolean;
}) {
  return (
    <div className="shrink-0 flex flex-wrap items-center justify-between gap-4 xl:items-start">
      <div className="flex min-w-0 items-start gap-3">
        <PixelButton
          onClick={onBackHome}
          variant="ghost"
          size="sm"
          square
          aria-label="返回主页"
          className="mt-1 h-9 w-9.5 shrink-0"
        >
          <ArrowLeft size={22} />
        </PixelButton>
        <div className="min-w-0">
          <h2 className="mt-2 text-2xl font-black text-[#fff6cf]">房间列表</h2>
        </div>
      </div>
      <div className="flex w-full flex-wrap items-center justify-end gap-2 xl:w-auto">
        <PixelButton onClick={onCreateRoom} disabled={Boolean(pendingAction)} variant="primary" size="sm">
          创建房间
        </PixelButton>
        <PixelButton onClick={onJoinRoom} disabled={Boolean(pendingAction)} variant="ghost" size="sm">
          加入房间
        </PixelButton>
        <PixelButton
          onClick={onRefreshRooms}
          disabled={refreshingRooms}
          variant="secondary"
          size="sm"
          square
          aria-label={refreshingRooms ? "刷新中" : "刷新列表"}
          title={refreshingRooms ? "刷新中" : "刷新列表"}
          className="h-9 w-9.5 shrink-0"
        >
          <RefreshCw size={18} className={refreshingRooms ? "animate-spin" : ""} />
        </PixelButton>
      </div>
    </div>
  );
}
