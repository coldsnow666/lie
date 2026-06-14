/**
 * @Description: 质疑流程遮罩，按当前玩家视角展示质疑发起、翻牌结果和下一行动方。
 *
 * @Date 2026-06-14 00:00
 */
import type { ReactNode } from "react";
import type { ChallengeResolvedGameEvent, GamePlayer } from "../model/gameTableTypes";

type ChallengeOverlayPhase = "announce" | "result";

function findPlayerName(players: GamePlayer[], playerId: string, fallback: string) {
  return players.find((player) => player.playerId === playerId)?.nickname ?? fallback;
}

function formatActorName(players: GamePlayer[], playerId: string, selfPlayerId?: string | null, fallback = "玩家") {
  if (playerId === selfPlayerId) {
    return "你";
  }

  return findPlayerName(players, playerId, fallback);
}

function Highlight({ children, tone = "name" }: { children: string; tone?: "name" | "result" | "action" }) {
  return (
    <span className="lie-challenge-overlay-highlight" data-tone={tone}>
      {children}
    </span>
  );
}

function getAnnounceTitle({
  event,
  players,
  selfPlayerId,
}: {
  event: ChallengeResolvedGameEvent;
  players: GamePlayer[];
  selfPlayerId?: string | null;
}): ReactNode {
  const challengerName = formatActorName(players, event.challengerPlayerId, selfPlayerId, "质疑者");
  const challengedName = formatActorName(players, event.challengedPlayerId, selfPlayerId, "上一手玩家");

  if (event.challengerPlayerId === selfPlayerId) {
    return (
      <>
        <Highlight>你</Highlight>质疑了<Highlight>{challengedName}</Highlight>
      </>
    );
  }

  if (event.challengedPlayerId === selfPlayerId) {
    return (
      <>
        <Highlight>{challengerName}</Highlight>质疑<Highlight>你</Highlight>
      </>
    );
  }

  return (
    <>
      <Highlight>{challengerName}</Highlight>质疑<Highlight>{challengedName}</Highlight>
    </>
  );
}

function getResultTitle({
  event,
  players,
  selfPlayerId,
}: {
  event: ChallengeResolvedGameEvent;
  players: GamePlayer[];
  selfPlayerId?: string | null;
}): ReactNode {
  const challengerName = formatActorName(players, event.challengerPlayerId, selfPlayerId, "质疑者");
  const challengedName = formatActorName(players, event.challengedPlayerId, selfPlayerId, "上一手玩家");
  const resultLabel = event.wasTruthful ? "失败" : "成功";

  if (event.challengerPlayerId === selfPlayerId) {
    return (
      <>
        <Highlight>你</Highlight>质疑<Highlight>{challengedName}</Highlight>
        <Highlight tone="result">{resultLabel}</Highlight>
      </>
    );
  }

  if (event.challengedPlayerId === selfPlayerId) {
    return (
      <>
        <Highlight>{challengerName}</Highlight>质疑<Highlight>你</Highlight>
        <Highlight tone="result">{resultLabel}</Highlight>
      </>
    );
  }

  return (
    <>
      <Highlight>{challengerName}</Highlight>质疑<Highlight>{challengedName}</Highlight>
      <Highlight tone="result">{resultLabel}</Highlight>
    </>
  );
}

function getNextTurnText({
  event,
  nextPlayerId,
  players,
  selfPlayerId,
}: {
  event: ChallengeResolvedGameEvent;
  nextPlayerId?: string | null;
  players: GamePlayer[];
  selfPlayerId?: string | null;
}): ReactNode {
  if (!nextPlayerId) {
    return "等待下回合";
  }

  const nextName = formatActorName(players, nextPlayerId, selfPlayerId, "下一位玩家");
  const actionLabel = nextPlayerId === event.challengedPlayerId ? "继续出手" : "出手";

  return (
    <>
      下回合由<Highlight>{nextName}</Highlight>
      <Highlight tone="action">{actionLabel}</Highlight>
    </>
  );
}

export default function ChallengeOverlay({
  event,
  nextPlayerId,
  phase,
  players,
  selfPlayerId,
}: {
  event: ChallengeResolvedGameEvent | null;
  nextPlayerId?: string | null;
  phase: ChallengeOverlayPhase;
  players: GamePlayer[];
  selfPlayerId?: string | null;
}) {
  if (!event) {
    return null;
  }

  const pileTakerName = formatActorName(players, event.pileTakenByPlayerId, selfPlayerId, "失败方");
  const title = phase === "announce" ? getAnnounceTitle({ event, players, selfPlayerId }) : getResultTitle({ event, players, selfPlayerId });
  const nextTurnText = getNextTurnText({ event, nextPlayerId, players, selfPlayerId });

  return (
    <div className="lie-challenge-overlay" data-phase={phase} aria-live="assertive">
      <div className="lie-challenge-overlay-panel">
        <strong>{title}</strong>
        <span>
          {phase === "announce" ? (
            "准备掀开上一手"
          ) : (
            <>
              <Highlight>{pileTakerName}</Highlight>拿走弃牌堆
            </>
          )}
        </span>
        {phase === "result" ? <span>{nextTurnText}</span> : null}
      </div>
    </div>
  );
}
