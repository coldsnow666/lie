/**
 * 文件说明：等待房间操作区，负责展示准备、开始游戏和离开按钮。
 */
import { DoorOpen, Play, ToggleLeft, ToggleRight } from "lucide-react";
import PixelButton from "@/components/ui/PixelButton";
import { type PublicRoomPlayer } from "@/service/modules/game";

export default function WaitingRoomActions({
  busy,
  canStart,
  isOwner,
  onLeave,
  onReady,
  onStartGame,
  selfPlayer,
}: {
  busy: boolean;
  canStart: boolean;
  isOwner: boolean;
  onLeave: () => void;
  onReady: () => void;
  onStartGame: () => void;
  selfPlayer: PublicRoomPlayer | null;
}) {
  return (
    <div className="grid w-full grid-cols-2 items-center gap-2 lg:flex lg:flex-wrap lg:gap-3">
      {!isOwner ? (
        <PixelButton onClick={onReady} disabled={busy || !selfPlayer} variant="ghost" size="sm" className="h-9 min-w-0 px-2 text-xs lg:h-10 lg:flex-1 lg:px-4">
          {selfPlayer?.ready ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          {selfPlayer?.ready ? "取消准备" : "准备"}
        </PixelButton>
      ) : null}
      {isOwner ? (
        <PixelButton onClick={onStartGame} disabled={busy || !canStart} variant="primary" size="sm" className="h-9 min-w-0 px-2 text-xs lg:h-10 lg:flex-1 lg:px-4">
          <Play size={18} />
          开始游戏
        </PixelButton>
      ) : null}
      <PixelButton onClick={onLeave} disabled={busy} variant="danger" size="sm" className="h-9 min-w-0 px-2 text-xs lg:h-10 lg:flex-1 lg:px-4">
        <DoorOpen size={18} />
        离开
      </PixelButton>
    </div>
  );
}
