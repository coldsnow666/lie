/**
 * @Description: 游戏内短音效播放工具，复用 Audio 实例并尊重本地音效开关。
 *
 * @Date 2026-06-13 14:47
 */
"use client";

import { getGameAudioEnabled } from "@/lib/audio-settings";

type GameSound = "deal" | "play" | "return";

const soundSrcMap: Record<GameSound, string> = {
  deal: "/assets/audio/card-deal.ogg",
  play: "/assets/audio/card-play.ogg",
  return: "/assets/audio/card-deal.ogg",
};

const soundVolumeMap: Record<GameSound, number> = {
  deal: 0.34,
  play: 0.42,
  return: 0.3,
};

const audioPool = new Map<GameSound, HTMLAudioElement[]>();

function getAudio(sound: GameSound) {
  const pool = audioPool.get(sound) ?? [];
  const audio = pool.find((item) => item.paused || item.ended) ?? new Audio(soundSrcMap[sound]);

  if (!pool.includes(audio)) {
    pool.push(audio);
    audioPool.set(sound, pool);
  }

  audio.volume = soundVolumeMap[sound];
  audio.currentTime = 0;
  return audio;
}

export function playGameSound(sound: GameSound) {
  if (typeof window === "undefined" || !getGameAudioEnabled()) {
    return;
  }

  getAudio(sound)
    .play()
    .catch(() => {
      // 浏览器未获得用户手势授权时会拒绝播放，静默跳过即可。
    });
}
