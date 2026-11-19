"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  memo,
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
import { createFramePacing, qualityLevels, sampleFramePacing, type SceneQuality } from "./scene-quality";
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
  onCameraFrame: (progress: number, moving: boolean) => void;
  onActive?: (index: number) => void;
  modalOpen: boolean;
  active: number;
  forceLightweight: boolean;
  backdrop: boolean;
  reducedMotion: boolean;
};

function CameraPath({
  stops,
  screens,
  motion,
  reducedMotion,
  onCameraFrame,
  onActive,
}: Pick<WorldProps, "stops" | "motion" | "reducedMotion" | "onCameraFrame" | "onActive"> & {
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
  const position = useMemo(() => new Vector3(), []);
  const scroll = useRef<number | null>(null);
  const lastSnap = useRef(-1);
  const pointer = useRef({ x: 0, y: 0 });

  useFrame(({ camera }, delta) => {
    const tour = motion.current;
    if (document.hidden || tour.modal) {
      onCameraFrame(tour.progress, false);
      return;
    }
    const dt = Math.min(delta, tour.moving ? 0.05 : 1 / 60);
    const goal = reducedMotion ? tour.active : tour.target;
    const previous = scroll.current ?? goal;
    const remaining = goal - previous;
    const current = reducedMotion || lastSnap.current !== tour.snap || Math.abs(remaining) < 0.001
      ? goal
      : previous + MathUtils.clamp(remaining * (1 - Math.exp(-dt * 17)), -9 * dt, 9 * dt);
    scroll.current = current;
    lastSnap.current = tour.snap;
    const moving = current !== goal || Math.abs(current - previous) >= 0.001;

    // Ease each station's path after smoothing the shared scroll position once.
    // Every animated object and the chapter indicator read this displayed position.
    const station = Math.floor(current);
    const travel = MathUtils.clamp((current - station - 0.17) / 0.69, 0, 1);
    const progress = station + travel * travel * (3 - 2 * travel);
    onCameraFrame(progress, moving);
    onActive?.(Math.round(progress));

    const xOffset = reducedMotion ? 0 : tour.pointerX;
    const yOffset = reducedMotion ? 0 : tour.pointerY;
    const eye = pointer.current;
    eye.x = Math.abs(eye.x - xOffset) < 0.002 ? xOffset : MathUtils.damp(eye.x, xOffset, 19, dt);
    eye.y = Math.abs(eye.y - yOffset) < 0.002 ? yOffset : MathUtils.damp(eye.y, yOffset, 19, dt);
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
    const pointerStrength = 1 - 0.8 * MathUtils.smoothstep(progress, poses.length - 2, poses.length - 1);
    position.set(
      x + eye.x * 0.35 * pointerStrength,
      y + turn * 0.34 + eye.y * 0.18 * pointerStrength,
      z,
    );
    target.set(
      MathUtils.lerp(a.lookX, b.lookX, mix) +
        (b.x - a.x) * turn * 0.17 +
        steer * 0.72 +
        eye.x * 0.09 * pointerStrength,
      MathUtils.lerp(a.lookY, b.lookY, mix) + eye.y * 0.06 * pointerStrength,
      z - 21,
    );
    camera.position.copy(position);
    camera.lookAt(target);
    if (current !== goal || eye.x !== xOffset || eye.y !== yOffset)
      invalidate();
  }, -2);

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

function SceneFrame({
  frameRequestRef, onReady, onContextLost, onFailure, motion, ambient,
  level, bestLevel, onQuality,
}: Pick<WorldProps, "frameRequestRef" | "onReady" | "onContextLost" | "onFailure" | "motion"> & {
  ambient: boolean;
  level: number;
  bestLevel: number;
  onQuality: (level: number) => void;
}) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const context = gl.getContext();
  const canvas = gl.domElement;
  const lost = useRef(false);
  const rendered = useRef(false);
  const failed = useRef(false);
  const pacing = useRef(createFramePacing());
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
    const onVisibility = () => {
      pacing.current = createFramePacing();
      request();
    };
    document.addEventListener("visibilitychange", onVisibility);
    if (context.isContextLost()) suspend();
    return () => {
      if (frameRequestRef.current === request) frameRequestRef.current = null;
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [canvas, context, frameRequestRef, invalidate, suspend]);

  useEffect(() => {
    if (!ambient) return;
    const timer = window.setInterval(() => {
      if (!document.hidden && !motion.current.modal && !lost.current) invalidate();
    }, level < 2 ? 1000 / 30 : 1000 / 18);
    return () => window.clearInterval(timer);
  }, [ambient, invalidate, level, motion]);

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
    const next = sampleFramePacing(pacing.current, performance.now(), motion.current.moving, level, bestLevel);
    if (next !== level) onQuality(next);
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

const LoadedMediaScreen = memo(function LoadedMediaScreen(props: Omit<ComponentProps<typeof MediaScreen>, "poster">) {
  const { posterSrc, posterAvailable } = props.screen.item;
  const [poster, setPoster] = useState<{ src: string; texture: Texture }>();
  const anisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const maxSize = useThree((state) => Math.min(1920, state.gl.capabilities.maxTextureSize));
  useEffect(() => {
    if (!posterAvailable) return;
    let mounted = true;
    const texture = new TextureLoader().load(
      posterSrc,
      (loaded: Texture<HTMLImageElement | HTMLCanvasElement>) => {
        if (!mounted) return;
        const image = loaded.image as HTMLImageElement;
        const scale = maxSize / Math.max(image.width, image.height);
        if (scale < 1) {
          const posterCanvas = document.createElement("canvas");
          posterCanvas.width = Math.round(image.width * scale);
          posterCanvas.height = Math.round(image.height * scale);
          const context = posterCanvas.getContext("2d");
          if (context) {
            context.imageSmoothingQuality = "high";
            context.drawImage(image, 0, 0, posterCanvas.width, posterCanvas.height);
            loaded.image = posterCanvas;
          }
        }
        loaded.colorSpace = SRGBColorSpace;
        loaded.anisotropy = Math.min(2, anisotropy);
        setPoster({ src: posterSrc, texture: loaded });
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
  }, [anisotropy, maxSize, posterAvailable, posterSrc]);
  return <MediaScreen {...props} poster={poster?.src === posterSrc ? poster.texture : undefined} />;
});

function ExhibitionWorld({
  screens,
  stops,
  selectedProjects,
  motion,
  active,
  modalOpen,
  onOpen,
  quality,
  backdrop,
  reducedMotion,
}: Pick<WorldProps, "stops" | "selectedProjects" | "motion" | "active" | "modalOpen" | "onOpen" | "backdrop" | "reducedMotion"> & {
  screens: Screen[];
  quality: SceneQuality;
}) {
  const mediaScreens = useMemo(() => screens.map((screen) => {
    const stop = stops[screen.index];
    const item = stop.kind === "media"
      ? stop.items[selectedProjects[stop.id] ?? 0] ?? screen.item
      : screen.item;
    return item === screen.item ? screen : { ...screen, item };
  }), [screens, selectedProjects, stops]);
  return (
    <>
      <Hall
        stops={stops}
        screens={screens}
        motion={motion}
        quality={quality}
        reducedMotion={reducedMotion}
      />
      {!backdrop && mediaScreens.map((screen) => {
        const focused = active === screen.index || (active === 0 && screen.reel);
        return (
          <LoadedMediaScreen
            key={screen.index}
            screen={screen}
            focused={focused}
            interactive={!modalOpen && focused}
            onOpen={onOpen}
          />
        );
      })}
    </>
  );
}

export default function WorldCanvas(props: WorldProps) {
  const screens = useMemo(() => layoutScreens(props.stops), [props.stops]);
  const [touchPrimary] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const [selectedLevel, setLevel] = useState(0);
  const bestLevel = props.forceLightweight ? 2 : Number(touchPrimary || props.backdrop);
  const level = Math.max(bestLevel, selectedLevel);
  const quality = qualityLevels[level];
  const activeKind = props.stops[props.active]?.kind;
  const ambient = !props.reducedMotion && !props.modalOpen &&
    (props.active < 2 || activeKind === "bio" || activeKind === "tools");
  const createRenderer = useCallback(({ canvas }: { canvas: EventTarget }) => {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("The 3D scene could not attach to its canvas.");
    }
    const attributes: WebGLContextAttributes = {
      alpha: false,
      // Use resolution scaling instead of the cost of a multisampled backbuffer.
      antialias: false,
      powerPreference: "default",
      failIfMajorPerformanceCaveat: false,
    };
    const context = canvas.getContext("webgl2", attributes);
    if (!context) throw new Error("This browser could not create a WebGL 2 context.");
    const renderer = new WebGLRenderer({ canvas, context, ...attributes });
    renderer.debug.onShaderError = (context, program) => {
      if (!context.isContextLost()) {
        throw new Error(`A scene shader failed to link. ${context.getProgramInfoLog(program) ?? ""}`);
      }
    };
    return renderer;
  }, []);

  return (
    <div className="exhibit-world" aria-hidden="true">
      <Canvas
        dpr={[Math.min(1, quality.dpr), quality.dpr]}
        frameloop="demand"
        flat
        gl={createRenderer}
        style={{ pointerEvents: "inherit" }}
      >
        <CameraPath
          stops={props.stops}
          screens={screens}
          motion={props.motion}
          reducedMotion={props.reducedMotion}
          onCameraFrame={props.onCameraFrame}
          onActive={props.onActive}
        />
        <ExhibitionWorld {...props} screens={screens} quality={quality} />
        <SceneFrame {...props} ambient={ambient} level={level} bestLevel={bestLevel} onQuality={setLevel} />
      </Canvas>
    </div>
  );
}
