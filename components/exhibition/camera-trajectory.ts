import type { Pose, Screen } from "./world-layout";

const response = 25;
const speedLimit = 12;
const linearThreshold = speedLimit / response;

// Integrate a bounded exponential exactly, including frames that cross from
// the constant-speed segment into the exponential settling segment.
export function advanceCamera(current: number, target: number, seconds: number) {
  const error = target - current;
  const distance = Math.abs(error);
  if (distance < 0.0005) return target;
  const linearTime = Math.max(0, (distance - linearThreshold) / speedLimit);
  const remaining = seconds <= linearTime
    ? distance - seconds * speedLimit
    : Math.min(distance, linearThreshold) * Math.exp(-response * (seconds - linearTime));
  return remaining < 0.0005 ? target : target - Math.sign(error) * remaining;
}

type Axis = keyof Pose;
const axes: Axis[] = ["x", "y", "z", "lookX", "lookY"];

function tangent(points: Pose[], index: number, axis: Axis) {
  const left = index > 0 ? points[index][axis] - points[index - 1][axis] : undefined;
  const right = index + 1 < points.length ? points[index + 1][axis] - points[index][axis] : undefined;
  if (left === undefined || right === undefined) return left ?? right ?? 0;
  return left * right <= 0 ? 0 : 2 * left * right / (left + right);
}

function interpolate(a: number, b: number, ta: number, tb: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return a + (b - a) * (3 * t2 - 2 * t3) + ta * (t3 - 2 * t2 + t) + tb * (t3 - t2);
}

export function createTrajectory(poses: Pose[], screens: Screen[]) {
  const tangents = poses.map((_, index) => ({
    x: tangent(poses, index, "x"),
    y: tangent(poses, index, "y"),
    z: tangent(poses, index, "z"),
    lookX: tangent(poses, index, "lookX"),
    lookY: tangent(poses, index, "lookY"),
  }));
  const crossings = poses.slice(0, -1).map((a, i) => {
    const b = poses[i + 1];
    const screen = screens.find(({ z }) => a.z > z && b.z < z);
    if (!screen) return null;
    let lo = 0, hi = 1;
    for (let step = 0; step < 20; step++) {
      const at = (lo + hi) / 2;
      const z = interpolate(a.z, b.z, tangents[i].z, tangents[i + 1].z, at);
      if (z > screen.z) lo = at;
      else hi = at;
    }
    return {
      at: (lo + hi) / 2,
      clearX: screen.x - screen.side * (screen.width * 0.5 + 1.3),
    };
  });

  return (progress: number, out: Pose) => {
    const index = Math.min(poses.length - 2, Math.max(0, Math.floor(progress)));
    const t = Math.min(1, Math.max(0, progress - index));
    const a = poses[index];
    const b = poses[index + 1];
    const ta = tangents[index];
    const tb = tangents[index + 1];
    for (const axis of axes) out[axis] = interpolate(a[axis], b[axis], ta[axis], tb[axis], t);
    const crossing = crossings[index];
    if (crossing) {
      const u = t < crossing.at ? t / crossing.at : (1 - t) / (1 - crossing.at);
      const weight = u * u * u * (u * (6 * u - 15) + 10);
      const steer = (crossing.clearX - out.x) * weight;
      out.x += steer;
      out.lookX += steer * 0.72;
    }
    const turn = t * t * (1 - t) * (1 - t) * 16;
    out.y += turn * 0.34;
    out.lookX += (b.x - a.x) * turn * 0.17;
  };
}
