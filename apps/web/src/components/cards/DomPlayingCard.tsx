/**
 * @Description: 用 DOM 绘制扑克牌牌面，仅在人物牌和王中复用雪碧图中心图案。
 *
 * @Date 2026-06-12 14:47
 */
import type { CSSProperties, ReactNode } from "react";
import { isJokerRank, type Card as CardType, type DeclaredRank, type StandardSuit, type Suit } from "@lie/shared";
import { getCardLabel, RANK_LABELS } from "@/lib/card-assets";
import CourtCardArt from "./CourtCardArt";
import JokerCardArt from "./JokerCardArt";

const SUIT_SYMBOLS: Record<Suit, string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
  JOKER: "★",
};

const PIP_LAYOUTS: Partial<Record<DeclaredRank, string[]>> = {
  A: ["center"],
  "2": ["top", "bottom"],
  "3": ["top", "center", "bottom"],
  "4": ["top-left", "top-right", "bottom-left", "bottom-right"],
  "5": ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
  "6": ["top-left", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-right"],
  "7": ["top-left", "top-right", "upper-center", "middle-left", "middle-right", "bottom-left", "bottom-right"],
  "8": [
    "top-left",
    "top-right",
    "upper-center",
    "middle-left",
    "middle-right",
    "lower-center",
    "bottom-left",
    "bottom-right",
  ],
  "9": [
    "top-left",
    "top-right",
    "upper-left",
    "upper-right",
    "center",
    "lower-left",
    "lower-right",
    "bottom-left",
    "bottom-right",
  ],
  "10": [
    "top-left",
    "top-right",
    "upper-left",
    "upper-right",
    "upper-center",
    "lower-center",
    "lower-left",
    "lower-right",
    "bottom-left",
    "bottom-right",
  ],
};

const pipClassMap: Record<string, string> = {
  "top-left": "left-[24%] top-[19%]",
  "top-right": "right-[24%] top-[19%]",
  top: "left-1/2 top-[19%] -translate-x-1/2",
  "upper-left": "left-[24%] top-[32%]",
  "upper-right": "right-[24%] top-[32%]",
  "upper-center": "left-1/2 top-[32%] -translate-x-1/2",
  "middle-left": "left-[24%] top-1/2 -translate-y-1/2",
  "middle-right": "right-[24%] top-1/2 -translate-y-1/2",
  center: "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
  "lower-left": "left-[24%] bottom-[32%]",
  "lower-right": "right-[24%] bottom-[32%]",
  "lower-center": "left-1/2 bottom-[32%] -translate-x-1/2",
  "bottom-left": "left-[24%] bottom-[19%] rotate-180",
  "bottom-right": "right-[24%] bottom-[19%] rotate-180",
  bottom: "left-1/2 bottom-[19%] -translate-x-1/2 rotate-180",
};

type DomPlayingCardProps = {
  card?: CardType;
  displayRank?: string;
  joker?: "black" | "red";
  label?: string;
  jokerLetters?: readonly string[];
  jokerCenterContent?: ReactNode;
  className?: string;
};

type StandardCard = CardType & {
  rank: DeclaredRank;
  suit: StandardSuit;
};

const JOKER_LETTERS = ["J", "O", "K", "E", "R"] as const;

function isRedSuit(suit: Suit) {
  return suit === "H" || suit === "D";
}

function isStandardCard(card?: CardType): card is StandardCard {
  if (!card) {
    return false;
  }

  return !isJokerRank(card.rank);
}

const pixelCardClipPath = `polygon(
  var(--dom-card-radius) 0,
  calc(100% - var(--dom-card-radius)) 0,
  calc(100% - var(--dom-card-radius)) var(--dom-card-step-1),
  calc(100% - var(--dom-card-step-3)) var(--dom-card-step-1),
  calc(100% - var(--dom-card-step-3)) var(--dom-card-step-2),
  calc(100% - var(--dom-card-step-2)) var(--dom-card-step-2),
  calc(100% - var(--dom-card-step-2)) var(--dom-card-step-3),
  calc(100% - var(--dom-card-step-1)) var(--dom-card-step-3),
  calc(100% - var(--dom-card-step-1)) var(--dom-card-radius),
  100% var(--dom-card-radius),
  100% calc(100% - var(--dom-card-radius)),
  calc(100% - var(--dom-card-step-1)) calc(100% - var(--dom-card-radius)),
  calc(100% - var(--dom-card-step-1)) calc(100% - var(--dom-card-step-3)),
  calc(100% - var(--dom-card-step-2)) calc(100% - var(--dom-card-step-3)),
  calc(100% - var(--dom-card-step-2)) calc(100% - var(--dom-card-step-2)),
  calc(100% - var(--dom-card-step-3)) calc(100% - var(--dom-card-step-2)),
  calc(100% - var(--dom-card-step-3)) calc(100% - var(--dom-card-step-1)),
  calc(100% - var(--dom-card-radius)) calc(100% - var(--dom-card-step-1)),
  calc(100% - var(--dom-card-radius)) 100%,
  var(--dom-card-radius) 100%,
  var(--dom-card-radius) calc(100% - var(--dom-card-step-1)),
  var(--dom-card-step-3) calc(100% - var(--dom-card-step-1)),
  var(--dom-card-step-3) calc(100% - var(--dom-card-step-2)),
  var(--dom-card-step-2) calc(100% - var(--dom-card-step-2)),
  var(--dom-card-step-2) calc(100% - var(--dom-card-step-3)),
  var(--dom-card-step-1) calc(100% - var(--dom-card-step-3)),
  var(--dom-card-step-1) calc(100% - var(--dom-card-radius)),
  0 calc(100% - var(--dom-card-radius)),
  0 var(--dom-card-radius),
  var(--dom-card-step-1) var(--dom-card-radius),
  var(--dom-card-step-1) var(--dom-card-step-3),
  var(--dom-card-step-2) var(--dom-card-step-3),
  var(--dom-card-step-2) var(--dom-card-step-2),
  var(--dom-card-step-3) var(--dom-card-step-2),
  var(--dom-card-step-3) var(--dom-card-step-1),
  var(--dom-card-radius) var(--dom-card-step-1)
)`;

const pixelCardStyle = {
  "--dom-card-border-size": "calc(1px * var(--pixel-card-scale, 2))",
  "--dom-card-radius": "calc(2px * var(--pixel-card-scale, 2))",
  "--dom-card-step-1": "calc(1px * var(--pixel-card-scale, 2))",
  "--dom-card-step-2": "calc(1px * var(--pixel-card-scale, 2))",
  "--dom-card-step-3": "calc(2px * var(--pixel-card-scale, 2))",
  background: "#17251f",
  clipPath: pixelCardClipPath,
} as CSSProperties;

const pixelCardFaceStyle = {
  position: "absolute",
  inset: "var(--dom-card-border-size)",
  background: "var(--dom-card-face-bg, #eef4eb)",
  boxShadow: "inset 0 0 calc(2px * var(--pixel-card-scale, 2)) rgba(23, 37, 31, 0.28)",
  clipPath: pixelCardClipPath,
} as CSSProperties;

export default function DomPlayingCard({
  card,
  displayRank,
  joker,
  label: customLabel,
  jokerLetters,
  jokerCenterContent,
  className = "",
}: DomPlayingCardProps) {
  const jokerColor = joker ?? (card?.rank === "RED_JOKER" ? "red" : card?.rank === "BLACK_JOKER" ? "black" : null);
  const playingCard = isStandardCard(card) ? card : null;
  const red = jokerColor === "red" || (playingCard ? isRedSuit(playingCard.suit) : false);
  const label = customLabel ?? (card ? getCardLabel(card) : jokerColor === "red" ? "大王" : "小王");
  const jokerLabelLetters = jokerLetters ?? JOKER_LETTERS;
  const rank = playingCard ? (displayRank ?? RANK_LABELS[playingCard.rank]) : null;
  const customRankLetters = displayRank ? Array.from(displayRank) : null;
  const suit = playingCard ? SUIT_SYMBOLS[playingCard.suit] : null;
  const toneClassName = red ? "text-[#b33332]" : "text-[#17251f]";
  const pipLayout = playingCard ? PIP_LAYOUTS[playingCard.rank] : undefined;
  const pipSizeClassName =
    playingCard?.rank === "A"
      ? "text-[length:calc(16px*var(--pixel-card-scale,2))]"
      : "text-[length:calc(9px*var(--pixel-card-scale,2))]";

  return (
    <span
      role="img"
      aria-label={label}
      className={`lie-dom-playing-card relative block aspect-[49/65] w-[calc(49px*var(--pixel-card-scale,2))] select-none overflow-hidden text-[#17251f] ${className}`}
      style={pixelCardStyle}
    >
      <span aria-hidden className="lie-dom-playing-card-face" style={pixelCardFaceStyle} />
      {playingCard ? (
        <>
          <span
            className={`absolute left-[8%] top-[8%] z-[1] grid justify-items-center text-[length:calc(6px*var(--pixel-card-scale,2))] leading-none ${toneClassName}`}
          >
            {customRankLetters
              ? customRankLetters.map((letter, index) => <span key={`top-rank-${letter}-${index}`}>{letter}</span>)
              : <span>{rank}</span>}
            <span>{suit}</span>
          </span>
          <span
            className={`absolute bottom-[8%] right-[8%] z-[1] grid rotate-180 justify-items-center text-[length:calc(6px*var(--pixel-card-scale,2))] leading-none ${toneClassName}`}
          >
            {customRankLetters
              ? customRankLetters.map((letter, index) => <span key={`bottom-rank-${letter}-${index}`}>{letter}</span>)
              : <span>{rank}</span>}
            <span>{suit}</span>
          </span>
        </>
      ) : (
        <>
          <span
            className={`absolute left-[8%] top-[7%] z-[1] grid justify-items-center text-[length:calc(4.4px*var(--pixel-card-scale,2))] font-black leading-[0.82] ${toneClassName}`}
          >
            {jokerLabelLetters.map((letter) => (
              <span key={`top-${letter}`}>{letter}</span>
            ))}
          </span>
          <span
            className={`absolute bottom-[7%] right-[8%] z-[1] grid rotate-180 justify-items-center text-[length:calc(4.4px*var(--pixel-card-scale,2))] font-black leading-[0.82] ${toneClassName}`}
          >
            {jokerLabelLetters.map((letter) => (
              <span key={`bottom-${letter}`}>{letter}</span>
            ))}
          </span>
        </>
      )}

      {pipLayout ? (
        pipLayout.map((slot, index) => (
          <span
            key={`${slot}-${index}`}
            className={`absolute z-[1] leading-none ${pipSizeClassName} ${toneClassName} ${pipClassMap[slot]}`}
          >
            {suit}
          </span>
        ))
      ) : (
        <span className="absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2">
          {playingCard ? (
            <CourtCardArt rank={playingCard.rank} label={`${label}中心图案`} className="[--court-card-art-width:28px]" />
          ) : jokerCenterContent ? (
            jokerCenterContent
          ) : (
            <JokerCardArt color={jokerColor ?? "black"} label={`${label}中心图案`} />
          )}
        </span>
      )}
    </span>
  );
}
