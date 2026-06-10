/**
 * 文件说明：从独立卡背素材图中裁切四张像素牌背。
 */
import type { CSSProperties } from "react";

const CARD_BACK_ART = {
  src: "/assets/cards/CardBack.png",
  imageWidth: 1509,
  imageHeight: 498,
} as const;

const cardBackCropMap = [
  { x: 43, y: 4, width: 348, height: 460 },
  { x: 393, y: 4, width: 351, height: 460 },
  { x: 745, y: 4, width: 358, height: 460 },
  { x: 1106, y: 4, width: 375, height: 460 },
] as const;

export default function CardBackArt({ back = 0, label, className = "" }: { back?: number; label: string; className?: string }) {
  const crop = cardBackCropMap[Math.max(0, Math.min(back, cardBackCropMap.length - 1))];

  return (
    <span
      role="img"
      aria-label={label}
      className={`block select-none overflow-visible bg-no-repeat [image-rendering:pixelated] ${className}`}
      style={
        {
          "--card-back-render-width": "calc(var(--card-back-art-width, 49px) * var(--card-back-scale, 1))",
          "--card-back-render-height": "calc(var(--card-back-art-height, 65px) * var(--card-back-scale, 1))",
          width: "var(--card-back-render-width)",
          height: "var(--card-back-render-height)",
          backgroundImage: `url("${CARD_BACK_ART.src}")`,
          backgroundPosition: `calc(-${crop.x / crop.width} * var(--card-back-render-width)) calc(-${crop.y / crop.height} * var(--card-back-render-height))`,
          backgroundSize: `calc(${CARD_BACK_ART.imageWidth / crop.width} * var(--card-back-render-width)) calc(${CARD_BACK_ART.imageHeight / crop.height} * var(--card-back-render-height))`,
        } as CSSProperties
      }
    />
  );
}
