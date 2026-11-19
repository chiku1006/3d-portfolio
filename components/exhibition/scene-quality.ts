export const qualityLevels = [
  { dpr: 1.5, distantStars: 4850, nearStars: 1240, planetSegments: 48, fineDetail: true },
  { dpr: 1.15, distantStars: 4100, nearStars: 1000, planetSegments: 40, fineDetail: true },
  { dpr: 0.85, distantStars: 3400, nearStars: 760, planetSegments: 32, fineDetail: false },
  { dpr: 0.65, distantStars: 2800, nearStars: 580, planetSegments: 28, fineDetail: false },
] as const;

export type SceneQuality = (typeof qualityLevels)[number];

type FramePacing = {
  previous: number;
  frames: number;
  late: number;
  fastTime: number;
  holdUntil: number;
};

export function createFramePacing(): FramePacing {
  return { previous: 0, frames: 0, late: 0, fastTime: 0, holdUntil: 0 };
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
    return level;
  }
  const previous = pacing.previous;
  pacing.previous = now;
  if (!previous) return level;

  const frameTime = now - previous;
  pacing.frames++;
  if (frameTime > 21) pacing.late++;
  pacing.fastTime = frameTime < 17.5 ? pacing.fastTime + frameTime : 0;

  // Respond to sustained misses quickly and only raise resolution after a stable run.
  let next = level;
  if (pacing.frames >= 8 && pacing.late >= 5 && level < qualityLevels.length - 1) {
    next++;
  } else if (pacing.fastTime > 5000 && level > bestLevel) {
    next--;
  }
  if (next !== level) {
    pacing.holdUntil = now + 280;
    pacing.fastTime = 0;
  }
  if (pacing.frames >= 12 || next !== level) {
    pacing.frames = 0;
    pacing.late = 0;
  }
  return next;
}
