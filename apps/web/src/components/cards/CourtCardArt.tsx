/**
 * @Description: 从自定义 JQK 素材图中裁切人物牌中心图案。
 *
 * @Date 2026-06-12 14:47
 */
import type { CSSProperties } from "react";
import type { Rank } from "@lie/shared";

const JQK_ART = {
  src: "/assets/cards/JQK.png",
  imageWidth: 1500,
  imageHeight: 541,
} as const;

const rankCropMap: Partial<Record<Rank, { x: number; y: number; width: number; height: number }>> = {
  J: { x: 202, y: 65, width: 273, height: 453 },
  Q: { x: 615, y: 66, width: 280, height: 454 },
  K: { x: 1110, y: 65, width: 276, height: 454 },
};

export default function CourtCardArt({ rank, label, className = "" }: { rank: Rank; label: string; className?: string }) {
  const crop = rankCropMap[rank] ?? rankCropMap.J;

  return (
    <span
      role="img"
      aria-label={label}
      className={`block select-none overflow-hidden bg-no-repeat [image-rendering:pixelated] ${className}`}
      style={
        {
          "--court-card-render-width": "calc(var(--court-card-art-width, 28px) * var(--pixel-card-scale, 2))",
          width: "var(--court-card-render-width)",
          aspectRatio: `${crop?.width ?? 1} / ${crop?.height ?? 1}`,
          backgroundImage: `url("${JQK_ART.src}")`,
          backgroundPosition: `calc(-${(crop?.x ?? 0) / (crop?.width ?? 1)} * var(--court-card-render-width)) calc(-${(crop?.y ?? 0) / (crop?.width ?? 1)} * var(--court-card-render-width))`,
          backgroundSize: `calc(${JQK_ART.imageWidth / (crop?.width ?? 1)} * var(--court-card-render-width)) auto`,
        } as CSSProperties
      }
    />
  );
}
