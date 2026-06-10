/**
 * 文件说明：从自定义 Joker 素材图中裁切大小王中心图案。
 */
import type { CSSProperties } from "react";

const JOKER_ART = {
  src: "/assets/cards/Joker.png",
  imageWidth: 1513,
  imageHeight: 469,
} as const;

const jokerCropMap = {
  red: { x: 210, y: 28, width: 368, height: 378 },
  black: { x: 914, y: 28, width: 361, height: 378 },
} as const;

export default function JokerCardArt({
  color,
  label,
  className = "",
}: {
  color: "black" | "red";
  label: string;
  className?: string;
}) {
  const crop = jokerCropMap[color];

  return (
    <span
      role="img"
      aria-label={label}
      className={`block select-none overflow-hidden bg-no-repeat [image-rendering:pixelated] ${className}`}
      style={
        {
          "--joker-card-render-width": "calc(var(--joker-card-art-width, 30px) * var(--pixel-card-scale, 2))",
          width: "var(--joker-card-render-width)",
          aspectRatio: `${crop.width} / ${crop.height}`,
          backgroundImage: `url("${JOKER_ART.src}")`,
          backgroundPosition: `calc(-${crop.x / crop.width} * var(--joker-card-render-width)) calc(-${crop.y / crop.width} * var(--joker-card-render-width))`,
          backgroundSize: `calc(${JOKER_ART.imageWidth / crop.width} * var(--joker-card-render-width)) auto`,
        } as CSSProperties
      }
    />
  );
}
