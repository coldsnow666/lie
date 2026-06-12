/**
 * @Description: 牌桌中心提示，展示上一手信息和质疑成功/失败结算文案。
 *
 * @Date 2026-06-12 14:47
 */
import type { DeclaredRank, PublicGameState } from "@lie/shared";
import type { ChallengeResolvedGameEvent, GamePlayer } from "./gameTableTypes";

export function TableStatusPanel({ followRank, state }: { followRank: DeclaredRank | null; state: PublicGameState }) {
  return (
    <aside className="lie-table-status-panel" aria-label="当前牌桌状态">
      <div>
        <span className="lie-table-status-label">弃牌区</span>
        <strong>共 {state.discardPileCount} 张</strong>
      </div>
      <div>
        <span className="lie-table-status-label">当前点数</span>
        <strong>{followRank ?? "待声明"}</strong>
      </div>
    </aside>
  );
}

export function TableCenterNotice({
  event,
  players,
  selfPlayerId,
  state,
}: {
  event: ChallengeResolvedGameEvent | null;
  players: GamePlayer[];
  selfPlayerId?: string | null;
  state: PublicGameState;
}) {
  if (event) {
    const pileTaker = players.find((player) => player.playerId === event.pileTakenByPlayerId);
    const resultLabel = event.wasTruthful ? "质疑失败" : "质疑成功";
    const takerLabel = event.pileTakenByPlayerId === selfPlayerId ? "你" : (pileTaker?.nickname ?? "失败方");

    return (
      <div className="lie-table-center-notice" data-kind="challenge" data-truthful={event.wasTruthful ? "true" : "false"} aria-live="polite">
        <strong>{resultLabel}</strong>
        <span>{takerLabel}拿走弃牌堆</span>
      </div>
    );
  }

  const lastPlayPlayer = state.players.find((player) => player.playerId === state.lastPlay?.playerId);
  const lastPlayLabel = state.lastPlay ? `${lastPlayPlayer?.nickname ?? "上一手玩家"} 打出 ${state.lastPlay.cardCount} 张` : "无";

  return (
    <div className="lie-table-center-notice" data-kind="last-play" aria-live="polite">
      <strong>上一手</strong>
      <span>{lastPlayLabel}</span>
    </div>
  );
}
