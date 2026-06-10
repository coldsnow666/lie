/**
 * 文件说明：用雪碧图裁切渲染单张像素扑克牌。
 */
import type { CSSProperties } from "react";
import type { Card as CardType } from "@lie/shared";
import {
  getCardLabel,
  getPixelCourtSpriteRect,
  getPixelCardBackSpritePosition,
  getPixelCardSpritePosition,
  getPixelJokerSpriteRect,
  getPixelJokerSpritePosition,
  PIXEL_CARD_BACK_SPRITE,
  PIXEL_CARD_SPRITE,
} from "@/lib/card-assets";

type PixelCardSpriteProps = {
  card?: CardType;
  joker?: "black" | "red";
  back?: number;
  crop?: "card" | "court" | "joker-art";
  label?: string;
  className?: string;
};

export default function PixelCardSprite({ card, joker, back, crop = "card", label, className = "" }: PixelCardSpriteProps) {
  const sprite = back === undefined ? PIXEL_CARD_SPRITE : PIXEL_CARD_BACK_SPRITE;
  const rect =
    crop === "court" && card
      ? getPixelCourtSpriteRect(card)
      : crop === "joker-art" && joker
        ? getPixelJokerSpriteRect(joker)
        : null;
  const position = rect ??
    back !== undefined
      ? getPixelCardBackSpritePosition(back)
      : joker
        ? getPixelJokerSpritePosition(joker)
        : card
          ? getPixelCardSpritePosition(card)
          : { x: 0, y: 0 };
  const accessibleLabel = label ?? (card ? getCardLabel(card) : joker ? (joker === "black" ? "小王" : "大王") : `牌背 ${back ?? 1}`);

  return (
    <span
      role="img"
      aria-label={accessibleLabel}
      className={`block select-none overflow-hidden bg-no-repeat [image-rendering:pixelated] ${className}`}
      style={
        {
          width: `calc(${rect?.width ?? sprite.cardWidth}px * var(--pixel-card-scale, 2))`,
          height: `calc(${rect?.height ?? sprite.cardHeight}px * var(--pixel-card-scale, 2))`,
          backgroundImage: `url("${sprite.src}")`,
          backgroundPosition: `calc(-${position.x}px * var(--pixel-card-scale, 2)) calc(-${position.y}px * var(--pixel-card-scale, 2))`,
          backgroundSize: `calc(${sprite.imageWidth}px * var(--pixel-card-scale, 2)) calc(${sprite.imageHeight}px * var(--pixel-card-scale, 2))`,
        } as CSSProperties
      }
    />
  );
}
