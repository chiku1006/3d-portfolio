import type { ExhibitMedia, Stop } from "./types";

export type Screen = {
  index: number;
  item: ExhibitMedia;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  yaw: number;
  side: 1 | -1;
  portrait: boolean;
  reel: boolean;
};

export const floor = -3.8;
export const fieldOfView = 46;
const tangent = Math.tan((fieldOfView * Math.PI) / 360);

export function depth(index: number) {
  return -11 - (index - 1) * 36;
}

export function layoutScreens(stops: Stop[]) {
  return stops.flatMap((stop, index): Screen[] => {
    if (!stop.item) return [];
    const side = stop.side ?? 1;
    const reel = stop.chapter === 1;
    const portrait = Boolean(stop.portrait);
    const width = portrait ? 3.8 : reel ? 10.8 : 9.3;
    return [
      {
        index,
        item: stop.item,
        x: side * (portrait ? 3.4 : reel ? 4.25 : 4.7),
        y: portrait ? 0.45 : 0.5 + ((index % 3) - 1) * 0.28,
        z: depth(index),
        width,
        height: width * (portrait ? 16 / 9 : 9 / 16),
        yaw: side * -0.1,
        side,
        portrait,
        reel,
      },
    ];
  });
}

export type Pose = {
  x: number;
  y: number;
  z: number;
  lookX: number;
  lookY: number;
};

export function layoutCamera(stops: Stop[], screens: Screen[], aspect: number) {
  const compact = aspect < 1.06;
  return stops.map((stop, index): Pose => {
    const arrival = stop.kind === "arrival";
    const surface = screens.find(
      (screen) => screen.index === (arrival ? 1 : index),
    );
    if (!surface) {
      const contact = stop.kind === "contact";
      const x = stop.kind === "tools" ? -1.25 : 0;
      return {
        x,
        y: contact ? 0.6 : 1,
        z: depth(index) + (compact ? 18 : 14),
        lookX: x,
        lookY: 0.6,
      };
    }

    const widthFraction = compact
      ? 0.9
      : arrival
        ? 0.48
        : surface.reel
          ? 0.64
          : 0.53;
    const heightFraction = compact
      ? arrival
        ? 0.41
        : surface.portrait
          ? 0.47
          : 0.44
      : 0.69;
    const distance = Math.max(
      surface.width / (2 * tangent * aspect * widthFraction),
      surface.height / (2 * tangent * heightFraction),
    );
    const x =
      surface.x -
      (compact
        ? 0
        : distance *
          tangent *
          aspect *
          surface.side *
          (arrival ? 0.41 : surface.reel ? 0.24 : 0.34));
    const y =
      surface.y +
      (compact
        ? (arrival ? 0.32 : surface.portrait ? -0.235 : -0.19) *
          distance *
          tangent
        : 0);
    return { x, y, z: surface.z + distance, lookX: x, lookY: y };
  });
}
