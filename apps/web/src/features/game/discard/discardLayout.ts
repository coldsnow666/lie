/**
 * @Description: 弃牌堆散落姿态计算。
 *
 * @Date 2026-06-14 00:00
 */
import { DISCARD_POSE_PATTERN } from "../model/gameTableConstants";

export function getScatteredDiscardPose(index: number) {
  const pattern = DISCARD_POSE_PATTERN[index % DISCARD_POSE_PATTERN.length];
  const lap = Math.floor(index / DISCARD_POSE_PATTERN.length);
  const lapDirection = lap % 2 === 0 ? 1 : -1;
  const x = pattern.x + lapDirection * Math.min(24, lap * 5);
  const y = pattern.y + ((lap * 13) % 25) - 12;
  const rotate = pattern.rotate + lapDirection * Math.min(18, lap * 4);

  return { x, y, rotate };
}
