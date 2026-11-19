"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type RefObject,
} from "react";
import {
  MathUtils,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  WebGLRenderer,
  type Texture,
} from "three";
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
  onContextLost: () => void;
  onFailure: (error: Error) => void;
  onOpen: (item: ExhibitMedia) => void;
  modalOpen: boolean;
  active: number;
  forceLightweight: boolean;
};

function CameraPath({
  stops,
  screens,
  motion,
}: Pick<WorldProps, "stops" | "motion"> & {
  screens: Screen[];
}) {
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
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

function SceneFrame({ frameRequestRef, onReady, onContextLost, onFailure }: Pick<
  WorldProps, "frameRequestRef" | "onReady" | "onContextLost" | "onFailure"
>) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const context = gl.getContext();
  const canvas = gl.domElement;
  const lost = useRef(false);
  const rendered = useRef(false);
  const failed = useRef(false);
  const suspend = useCallback(() => {
    if (lost.current || failed.current) return;
    lost.current = true;
    rendered.current = false;
    onContextLost();
  }, [onContextLost]);

  useLayoutEffect(() => {
    const request = () => {
      if (!document.hidden) invalidate();
    };
    const onLost = (event: Event) => {
      event.preventDefault();
      suspend();
    };
    const onRestored = () => {
      lost.current = false;
      request();
    };
    frameRequestRef.current = request;
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    document.addEventListener("visibilitychange", request);
    if (context.isContextLost()) suspend();
    return () => {
      if (frameRequestRef.current === request) frameRequestRef.current = null;
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      document.removeEventListener("visibilitychange", request);
    };
  }, [canvas, context, frameRequestRef, invalidate, suspend]);

  // Render after the scene's frame callbacks so the 2D view stays in place
  // until Three has drawn a frame on the actual canvas.
  useFrame(({ scene, camera }) => {
    if (document.hidden || failed.current || lost.current) return;
    if (context.isContextLost()) {
      suspend();
      return;
    }
    try {
      gl.render(scene, camera);
    } catch (error) {
      if (context.isContextLost()) {
        suspend();
      } else {
        failed.current = true;
        onFailure(new Error("The 3D scene failed to render.", { cause: error }));
      }
      return;
    }
    if (rendered.current) return;
    if (context.isContextLost()) {
      suspend();
      return;
    }
    rendered.current = true;
    onReady();
  }, 1);

  return null;
}

function LoadedMediaScreen(props: Omit<ComponentProps<typeof MediaScreen>, "poster">) {
  const { posterSrc } = props.screen.item;
  const [poster, setPoster] = useState<Texture>();
  const anisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  useEffect(() => {
    let mounted = true;
    const texture = new TextureLoader().load(
      posterSrc,
      (loaded) => {
        if (!mounted) return;
        loaded.colorSpace = SRGBColorSpace;
        loaded.anisotropy = Math.min(4, anisotropy);
        setPoster(loaded);
      },
      undefined,
      (error) => {
        if (mounted) console.warn(`[Portfolio 3D] Could not load poster ${posterSrc}.`, error);
      },
    );
    return () => {
      mounted = false;
      texture.dispose();
    };
  }, [anisotropy, posterSrc]);
  return <MediaScreen {...props} poster={poster} />;
}

function ExhibitionWorld({
  screens,
  stops,
  selectedProjects,
  motion,
  active,
  modalOpen,
  onOpen,
  lightweight,
}: Pick<WorldProps, "stops" | "selectedProjects" | "motion" | "active" | "modalOpen" | "onOpen"> & {
  screens: Screen[];
  lightweight: boolean;
}) {
  return (
    <>
      <Hall
        stops={stops}
        screens={screens}
        motion={motion}
        active={active}
        lightweight={lightweight}
      />
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
        return item.posterAvailable
          ? <LoadedMediaScreen key={`${item.id}:${item.posterSrc}`} {...props} />
          : <MediaScreen key={item.id} {...props} poster={undefined} />;
      })}
    </>
  );
}

export default function WorldCanvas(props: WorldProps) {
  const screens = useMemo(() => layoutScreens(props.stops), [props.stops]);
  const [touchPrimary] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const lightweight = touchPrimary || props.forceLightweight;
  const createRenderer = useCallback(({ canvas }: { canvas: EventTarget }) => {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("The 3D scene could not attach to its canvas.");
    }
    const attributes: WebGLContextAttributes = {
      alpha: false,
      antialias: !lightweight,
      powerPreference: "default",
      failIfMajorPerformanceCaveat: false,
    };
    let context = canvas.getContext("webgl2", attributes);
    if (!context && attributes.antialias) {
      attributes.antialias = false;
      context = canvas.getContext("webgl2", attributes);
    }
    if (!context) throw new Error("This browser could not create a WebGL 2 context.");
    const renderer = new WebGLRenderer({ canvas, context, ...attributes });
    renderer.debug.onShaderError = (context, program) => {
      if (!context.isContextLost()) {
        throw new Error(`A scene shader failed to link. ${context.getProgramInfoLog(program) ?? ""}`);
      }
    };
    return renderer;
  }, [lightweight]);

  return (
    <div className="exhibit-world" aria-hidden="true">
      <Canvas
        dpr={[1, props.forceLightweight ? 1 : lightweight ? 1.15 : 1.5]}
        frameloop="demand"
        flat
        gl={createRenderer}
      >
        <CameraPath stops={props.stops} screens={screens} motion={props.motion} />
        <ExhibitionWorld {...props} screens={screens} lightweight={lightweight} />
        <SceneFrame {...props} />
      </Canvas>
    </div>
  );
}
