export const qualityLevels = [
  { dpr: 1.5, distantStars: 4850, nearStars: 1240 },
  { dpr: 1.15, distantStars: 4100, nearStars: 1000 },
  { dpr: 0.85, distantStars: 3400, nearStars: 760 },
  { dpr: 0.65, distantStars: 2800, nearStars: 580 },
] as const;

export type SceneQuality = (typeof qualityLevels)[number];

type FramePacing = {
  previous: number;
  frames: number;
  late: number;
  fastTime: number;
  holdUntil: number;
  pending: number | null;
};

export function createFramePacing(): FramePacing {
  return { previous: 0, frames: 0, late: 0, fastTime: 0, holdUntil: 0, pending: null };
}

export function sampleFramePacing(
  pacing: FramePacing,
  now: number,
  moving: boolean,
  level: number,
  bestLevel: number,
) {
  if (!moving || now < pacing.holdUntil) {
    pacing.previous = 0;
    pacing.frames = 0;
    pacing.late = 0;
    if (!moving && pacing.pending !== null) {
      const next = Math.max(bestLevel, pacing.pending);
      pacing.pending = null;
      pacing.holdUntil = now + 2500;
      pacing.fastTime = 0;
      return next;
    }
    return level;
  }
  const previous = pacing.previous;
  pacing.previous = now;
  if (!previous) return level;

  const frameTime = now - previous;
  pacing.frames++;
  if (frameTime > 22) pacing.late++;
  pacing.fastTime = frameTime < 17.5 ? pacing.fastTime + frameTime : 0;

  // Respond to sustained misses quickly and only raise resolution after a stable run.
  let next = level;
  if (pacing.frames >= 14 && pacing.late >= 8 && level < qualityLevels.length - 1) {
    next = Math.min(qualityLevels.length - 1, level + (pacing.late >= 12 ? 2 : 1));
  } else if (pacing.fastTime > 8000 && level > bestLevel && pacing.pending === null) {
    next--;
  }
  if (next !== level) pacing.pending = Math.max(next, pacing.pending ?? next);
  if (pacing.frames >= 14) {
    pacing.frames = 0;
    pacing.late = 0;
  }
  // Apply a queued level only after the camera has finished its travel.
  return level;
}
