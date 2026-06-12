/**
 * @Description: 从独立卡背素材图中裁切四张像素牌背。
 *
 * @Date 2026-06-12 14:47
 */
import type { CSSProperties, HTMLAttributes } from "react";

const CARD_BACK_ART = {
  src: "/assets/cards/CardBack.png",
  imageWidth: 1509,
  imageHeight: 498,
} as const;

const cardBackPatternCropMap = [
  { x: 106, y: 59, width: 223, height: 350 },
  { x: 456, y: 59, width: 225, height: 350 },
  { x: 809, y: 59, width: 229, height: 350 },
  { x: 1174, y: 59, width: 240, height: 350 },
] as const;

export default function CardBackArt({
  back = 0,
  label,
  className = "",
  style,
  ...props
}: {
  back?: number;
  label: string;
  className?: string;
  style?: CSSProperties;
} & HTMLAttributes<HTMLSpanElement>) {
  const crop = cardBackPatternCropMap[Math.max(0, Math.min(back, cardBackPatternCropMap.length - 1))];

  return (
    <span
      role="img"
      aria-label={label}
      className={`lie-card-back-frame block select-none overflow-hidden ${className}`}
      {...props}
      style={
        {
          "--card-back-render-width": "calc(var(--card-back-art-width, 49px) * var(--card-back-scale, 1))",
          "--card-back-render-height": "calc(var(--card-back-art-height, 65px) * var(--card-back-scale, 1))",
          "--card-back-pattern-width": "calc(var(--card-back-render-width) - calc(12px * var(--card-back-scale, 1)))",
          "--card-back-pattern-height": "calc(var(--card-back-render-height) - calc(12px * var(--card-back-scale, 1)))",
          width: "var(--card-back-render-width)",
          height: "var(--card-back-render-height)",
          ...style,
        } as CSSProperties
      }
    >
      <span aria-hidden className="lie-card-back-face">
        <span
          aria-hidden
          className="lie-card-back-face-art"
          style={
            {
              backgroundImage: `url("${CARD_BACK_ART.src}")`,
              backgroundPosition: `calc(-${crop.x / crop.width} * var(--card-back-pattern-width)) calc(-${crop.y / crop.height} * var(--card-back-pattern-height))`,
              backgroundSize: `calc(${CARD_BACK_ART.imageWidth / crop.width} * var(--card-back-pattern-width)) calc(${CARD_BACK_ART.imageHeight / crop.height} * var(--card-back-pattern-height))`,
            } as CSSProperties
          }
        />
      </span>
    </span>
  );
}
