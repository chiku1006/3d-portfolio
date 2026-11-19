"use client";

import { PerspectiveCamera, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react";
import { MathUtils, SRGBColorSpace, Vector3, type Texture } from "three";
import { tools } from "./content";
import { Hall } from "./hall";
import { MediaScreen } from "./screen";
import type { ExhibitMedia, Stop, TourMotion } from "./types";
import {
  fieldOfView,
  layoutCamera,
  layoutScreens,
  type Screen,
} from "./world-layout";

type WorldProps = {
  stops: Stop[];
  selectedProjects: Record<string, number>;
  motion: RefObject<TourMotion>;
  frameRequestRef: RefObject<(() => void) | null>;
  onReady: () => void;
  onFailure: () => void;
  onOpen: (item: ExhibitMedia) => void;
  modalOpen: boolean;
  active: number;
};

class CanvasBoundary extends Component<
  { onFailure: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function CameraPath({
  stops,
  screens,
  motion,
  frameRequestRef,
  onFailure,
}: Pick<WorldProps, "stops" | "motion" | "frameRequestRef" | "onFailure"> & {
  screens: Screen[];
}) {
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const canvas = useThree((state) => state.gl.domElement);
  const poses = useMemo(
    () => layoutCamera(stops, screens, size.width / Math.max(size.height, 1), size.height),
    [stops, screens, size.width, size.height],
  );
  const crossings = useMemo(
    () =>
      poses.map((pose, i) => {
        const next = poses[i + 1];
        if (!next) return null;
        const screen = screens.find(({ z }) => pose.z > z && next.z < z);
        return screen
          ? {
              at: (pose.z - screen.z) / (pose.z - next.z),
              clearX: screen.x - screen.side * (screen.width * 0.5 + 1.3),
            }
          : null;
      }),
    [poses, screens],
  );
  const target = useMemo(() => new Vector3(), []);
  const aim = useMemo(() => new Vector3(), []);
  const position = useMemo(() => new Vector3(), []);
  const first = useRef(true);

  useEffect(() => {
    const lost = (event: Event) => {
      event.preventDefault();
      onFailure();
    };
    const request = () => {
      if (!document.hidden) invalidate();
    };
    frameRequestRef.current = request;
    canvas.addEventListener("webglcontextlost", lost);
    document.addEventListener("visibilitychange", request);
    return () => {
      frameRequestRef.current = null;
      canvas.removeEventListener("webglcontextlost", lost);
      document.removeEventListener("visibilitychange", request);
    };
  }, [canvas, frameRequestRef, invalidate, onFailure]);

  useFrame(({ camera }, delta) => {
    if (document.hidden || motion.current.modal) return;
    const { progress, pointerX, pointerY } = motion.current;
    const low = Math.min(poses.length - 1, Math.floor(progress));
    const high = Math.min(poses.length - 1, low + 1);
    const mix = MathUtils.clamp(progress - low, 0, 1);
    const a = poses[low];
    const b = poses[high];
    const turn = Math.sin(mix * Math.PI);
    const z = MathUtils.lerp(a.z, b.z, mix);
    const baseX = MathUtils.lerp(a.x, b.x, mix);
    const crossing = crossings[low];
    const steer = crossing
      ? (crossing.clearX - baseX) *
        (MathUtils.smoothstep(mix, 0, crossing.at) -
          MathUtils.smoothstep(mix, crossing.at, 1))
      : 0;
    const x = baseX + steer;
    const y = MathUtils.lerp(a.y, b.y, mix);
    const pointerStrength =
      1 -
      0.8 * MathUtils.smoothstep(progress, poses.length - 2, poses.length - 1);
    position.set(
      x + pointerX * 0.35 * pointerStrength,
      y + turn * 0.34 + pointerY * 0.18 * pointerStrength,
      z,
    );
    target.set(
      MathUtils.lerp(a.lookX, b.lookX, mix) +
        (b.x - a.x) * turn * 0.17 +
        steer * 0.72 +
        pointerX * 0.09 * pointerStrength,
      MathUtils.lerp(a.lookY, b.lookY, mix) + pointerY * 0.06 * pointerStrength,
      z - 21,
    );
    const snap =
      first.current || camera.position.distanceToSquared(position) > 2100;
    const mixFrame = snap ? 1 : 1 - Math.exp(-Math.min(delta, 0.05) * 15);
    first.current = false;
    camera.position.lerp(position, mixFrame);
    aim.lerp(target, mixFrame);
    camera.lookAt(aim);
    if (
      camera.position.distanceToSquared(position) > 0.00004 ||
      aim.distanceToSquared(target) > 0.00004
    )
      invalidate();
  });

  return (
    <PerspectiveCamera
      makeDefault
      fov={fieldOfView}
      near={0.15}
      far={110}
      position={[0, 0.8, 8]}
    />
  );
}

function configureTexture(texture: Texture, anisotropy: number) {
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
}

function LoadedMediaScreen(props: Omit<ComponentProps<typeof MediaScreen>, "poster">) {
  const texture = useTexture(props.screen.item.posterSrc);
  const limit = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  useLayoutEffect(() => {
    configureTexture(texture, Math.min(4, limit));
    return () => texture.dispose();
  }, [texture, limit]);
  return <MediaScreen {...props} poster={texture} />;
}

function ExhibitionWorld({
  screens,
  stops,
  selectedProjects,
  motion,
  active,
  modalOpen,
  onOpen,
  onReady,
}: Pick<WorldProps, "stops" | "selectedProjects" | "motion" | "active" | "modalOpen" | "onReady" | "onOpen"> & {
  screens: Screen[];
}) {
  const urls = useMemo(
    () => [
      ...screens
        .filter(({ item }) => item.posterAvailable)
        .map(({ item }) => item.posterSrc),
      ...tools.map(({ icon }) => icon),
    ],
    [screens],
  );
  const textures = useTexture(urls);
  const maps = useMemo(
    () =>
      Object.fromEntries(urls.map((url, i) => [url, textures[i]])) as Record<
        string,
        Texture
      >,
    [urls, textures],
  );
  const invalidate = useThree((state) => state.invalidate);
  const limit = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  useLayoutEffect(() => {
    textures.forEach((texture) => configureTexture(texture, Math.min(4, limit)));
    invalidate();
    return () => textures.forEach((texture) => texture.dispose());
  }, [textures, invalidate, limit]);
  useEffect(onReady, [onReady]);
  return (
    <>
      <Hall stops={stops} screens={screens} motion={motion} maps={maps} active={active} />
      {screens.map((screen) => {
        const stop = stops[screen.index];
        const item = stop.kind === "media"
          ? stop.items[selectedProjects[stop.id] ?? 0] ?? screen.item
          : screen.item;
        const focused = active === screen.index || (active === 0 && screen.reel);
        const props = {
          screen: { ...screen, item },
          focused,
          interactive: !modalOpen && focused,
          onOpen,
        };
        const poster = maps[item.posterSrc];
        if (poster || !item.posterAvailable) {
          return <MediaScreen key={item.id} {...props} poster={poster} />;
        }
        return (
          <Suspense
            key={item.id}
            fallback={<MediaScreen {...props} poster={undefined} interactive={false} />}
          >
            <LoadedMediaScreen {...props} />
          </Suspense>
        );
      })}
    </>
  );
}

export default function WorldCanvas(props: WorldProps) {
  const screens = useMemo(() => layoutScreens(props.stops), [props.stops]);
  return (
    <div className="exhibit-world" aria-hidden="true">
      <CanvasBoundary onFailure={props.onFailure}>
        <Canvas
          dpr={[1, 1.5]}
          frameloop="demand"
          flat
          gl={{ alpha: false, antialias: true, powerPreference: "default" }}
        >
          <CameraPath
            stops={props.stops}
            screens={screens}
            motion={props.motion}
            frameRequestRef={props.frameRequestRef}
            onFailure={props.onFailure}
          />
          <Suspense fallback={null}>
            <ExhibitionWorld
              screens={screens}
              stops={props.stops}
              selectedProjects={props.selectedProjects}
              motion={props.motion}
              active={props.active}
              modalOpen={props.modalOpen}
              onOpen={props.onOpen}
              onReady={props.onReady}
            />
          </Suspense>
        </Canvas>
      </CanvasBoundary>
    </div>
  );
}
