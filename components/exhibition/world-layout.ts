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

export const fieldOfView = 46;
const tangent = Math.tan((fieldOfView * Math.PI) / 360);

export function depth(index: number) {
  return -11 - (index - 1) * 36;
}

export function layoutScreens(stops: Stop[]) {
  return stops.flatMap((stop, index): Screen[] => {
    if (stop.kind !== "media" || !stop.items[0]) return [];
    const side = stop.side;
    const reel = stop.chapter === 1;
    const portrait = Boolean(stop.portrait);
    const width = portrait ? 3.8 : reel ? 10.8 : 9.3;
    return [
      {
        index,
        item: stop.items[0],
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

export function layoutCamera(
  stops: Stop[],
  screens: Screen[],
  aspect: number,
  height: number,
) {
  const compact = aspect < 1.06;
  const tight = compact ? Math.min(1, Math.max(0, (680 - height) / 120)) : 0;
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
      ? 0.9 - (arrival ? 0 : 0.08 * tight)
      : arrival
        ? 0.48
        : surface.reel
          ? 0.64
          : 0.53;
    const heightFraction = compact
      ? arrival
        ? 0.41
        : surface.portrait
          ? 0.47 - 0.16 * tight
          : 0.44 - 0.19 * tight
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
    const rise = arrival ? 0.32 : surface.portrait
      ? -0.235 - 0.22 * tight
      : -0.19 - 0.3 * tight;
    const y = surface.y + (compact ? rise * distance * tangent : 0);
    return { x, y, z: surface.z + distance, lookX: x, lookY: y };
  });
}

export type PlanetPlacement = {
  kind: "arrival" | "flow" | "contact";
  position: [number, number, number];
  radius: number;
  stop: number;
};

export function layoutSpacecraft(pose: Pose, aspect: number, height: number) {
  const compact = aspect < 1.06;
  const short = compact && height < 650;
  const distance = compact ? 15 : 16;
  const position: [number, number, number] = [
    pose.x + distance * tangent * aspect * (short ? 0.73 : compact ? 0.26 : 0.35),
    pose.y + distance * tangent * (compact ? 0.20 : 0.62),
    pose.z - distance,
  ];
  return { position, scale: short ? 0.37 : compact ? 0.48 : 0.57 };
}

export function layoutOrbitalDetail(
  pose: Pose,
  aspect: number,
  height: number,
  kind: "astronaut" | "satellite",
) {
  const compact = aspect < 1.06;
  const tight = compact && height < 650;
  const distance = 17;
  const astronaut = kind === "astronaut";
  const x = astronaut ? (compact ? 0.47 : -0.43) : (compact ? 0.38 : 0.69);
  const y = astronaut ? (compact ? 0.64 : 0.57) : (compact ? 0.62 : 0.33);
  const rise = tight ? y + (astronaut ? 0.03 : 0.105) : y;
  const position: [number, number, number] = [
    pose.x + distance * tangent * aspect * x,
    pose.y + distance * ((pose.lookY - pose.y) / 21 + tangent * rise),
    pose.z - distance,
  ];
  return { position, scale: tight ? 0.50 : compact ? 0.66 : astronaut ? 1.04 : 0.92 };
}

export function layoutPlanets(
  stops: Stop[],
  poses: Pose[],
  aspect: number,
  height: number,
): PlanetPlacement[] {
  const compact = aspect < 1.06;
  const short = compact && height < 650;
  return stops.flatMap((stop, index): PlanetPlacement[] => {
    const pose = poses[index];
    if (stop.kind === "arrival") {
      const behindScreen = depth(1) - 8;
      const distance = pose.z - behindScreen;
      return [
        {
          kind: "arrival",
          position: [
            pose.x + distance * tangent * aspect * (compact ? 1.17 : 0.89),
            pose.y + distance * tangent * (compact ? 0.68 : 0.79),
            behindScreen,
          ],
          radius: compact ? distance * 0.109 : 4.3,
          stop: index,
        },
      ];
    }
    if (stop.id === "work") {
      const distance = compact ? 12 : 10.8;
      const left = pose.x - distance * tangent * aspect * 0.89;
      return [
        {
          kind: "flow",
          position: [
            compact ? left : Math.min(-4.8, left),
            pose.y + distance * tangent * (short ? 0.80 : 0.73),
            pose.z - distance,
          ],
          radius: Math.min(short ? 0.62 : compact ? 0.89 : 1, distance * tangent * aspect * 0.53),
          stop: index,
        },
      ];
    }
    if (stop.kind === "contact") {
      return [
        {
          kind: "contact",
          position: [7, pose.y - 78, pose.z - 77],
          radius: 57,
          stop: index,
        },
      ];
    }
    return [];
  });
}
