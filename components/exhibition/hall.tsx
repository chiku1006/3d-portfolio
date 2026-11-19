import { Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { memo, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  MathUtils,
  RepeatWrapping,
  SphereGeometry,
  TextureLoader,
  Vector3,
  type Group,
  type BufferGeometry,
  type ShaderMaterial,
  type Texture,
} from "three";
import {
  atmosphereFragment,
  planetFragment,
  planetVertex,
  ringsFragment,
  ringsVertex,
  ringInner,
  ringOuter,
  spaceBackground,
  starsFragment,
  starsVertex,
} from "./shaders";
import { Spacecraft } from "./spacecraft";
import { OrbitalDetails } from "./orbital-details";
import { qualityLevels, type SceneQuality } from "./scene-quality";
import type { TexturePreparation } from "./texture-preparation";
import { WorldBoundary } from "./world-boundary";
import {
  depth,
  layoutCamera,
  layoutOrbitalDetail,
  layoutPlanets,
  layoutSpacecraft,
  type PlanetPlacement,
  type Screen,
} from "./world-layout";
import type { Stop, TourMotion } from "./types";

const planetLighting = {
  arrival: {
    night: "#0a1025",
    day: "#4c72af",
    rim: "#80c8ff",
    sun: [-0.86, 0.45, 0.07],
    bands: 0.22,
    tilt: [0, 0, 0.29],
    flattening: 1,
  },
  flow: {
    night: "#171328",
    day: "#6e569c",
    rim: "#b099f4",
    sun: [-0.69, 0.59, 0.38],
    bands: 0.58,
    tilt: [-0.44, 0, -0.24],
    flattening: 0.94,
  },
  contact: {
    night: "#090f23",
    day: "#5063a9",
    rim: "#9eaeff",
    sun: [-0.44, 0.85, -0.19],
    bands: 0.30,
    tilt: [0.62, 0, 0.21],
    flattening: 1,
  },
} as const;

function makePlanetLods() {
  return [
    { body: new SphereGeometry(1, 48, 34), atmosphere: new SphereGeometry(1, 44, 28) },
    { body: new SphereGeometry(1, 28, 20), atmosphere: new SphereGeometry(1, 26, 16) },
  ] as const;
}

function scatterStars(near: boolean, end: number, count: number) {
  const positions = new Float32Array(count * 3);
  const appearance = new Float32Array(count * 2);
  let seed = near ? 171 : 41;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    if (near) {
      const sign = random() < 0.5 ? -1 : 1;
      positions[i * 3] = sign * MathUtils.lerp(2.2, 30, random());
      positions[i * 3 + 1] = MathUtils.lerp(-14, 16, random());
      positions[i * 3 + 2] = MathUtils.lerp(26, end - 85, random());
    } else {
      // A fixed shell well beyond the tour keeps translation parallax small.
      const forward = MathUtils.lerp(0.33, 1, random());
      const angle = random() * Math.PI * 2;
      const distance = MathUtils.lerp(3900, 5100, random());
      const lateral = Math.sqrt(1 - forward * forward) * distance;
      positions[i * 3] = Math.cos(angle) * lateral;
      positions[i * 3 + 1] = Math.sin(angle) * lateral;
      positions[i * 3 + 2] = end * 0.5 - forward * distance;
    }
    appearance[i * 2] = random() ** 3.5;
    appearance[i * 2 + 1] = random() ** 1.7;
  }
  return { positions, appearance };
}

function Stars({ near = false, end, count }: { near?: boolean; end: number; count: number }) {
  const geometry = useRef<BufferGeometry>(null);
  const material = useRef<ShaderMaterial>(null);
  const invalidate = useThree((state) => state.invalidate);
  const maxCount = near ? qualityLevels[0].nearStars : qualityLevels[0].distantStars;
  const { positions, appearance } = useMemo(
    () => scatterStars(near, end, maxCount),
    [near, end, maxCount],
  );
  const uniforms = useMemo(
    () => ({ uDpr: { value: 1 }, uNearLayer: { value: Number(near) } }),
    [near],
  );
  useLayoutEffect(() => {
    geometry.current?.setDrawRange(0, count);
    invalidate();
  }, [count, invalidate]);
  useFrame(({ viewport }) => {
    if (material.current) material.current.uniforms.uDpr.value = viewport.dpr;
  });
  return (
    <points frustumCulled={near} renderOrder={near ? 1 : -1}>
      <bufferGeometry ref={geometry}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute
          attach="attributes-aAppearance"
          args={[appearance, 2]}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={starsVertex}
        fragmentShader={starsFragment}
        transparent
        depthWrite={false}
      />
    </points>
  );
}

function Planet({
  kind,
  position,
  radius,
  stop,
  motion,
  surface,
  geometry,
}: PlanetPlacement & {
  motion: RefObject<TourMotion>;
  surface: Texture | undefined;
  geometry: ReturnType<typeof makePlanetLods>[number];
}) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const axis = useRef<Group>(null);
  const surfaceMaterial = useRef<ShaderMaterial>(null);
  const atmosphereMaterial = useRef<ShaderMaterial>(null);
  const ringMaterial = useRef<ShaderMaterial>(null);
  const lighting = planetLighting[kind];
  const ringed = kind === "flow";
  const uniforms = useMemo(
    () => ({
      uNight: { value: new Color(lighting.night) },
      uDay: { value: new Color(lighting.day) },
      uRim: { value: new Color(lighting.rim) },
      uSun: { value: new Vector3(...lighting.sun).normalize() },
      uBands: { value: lighting.bands },
      uPresence: { value: 1 },
      uSurfaceReady: { value: Boolean(surface) },
      uSurface: { value: surface ?? null },
    }),
    [lighting, surface],
  );
  const ringUniforms = useMemo(
    () => ({
      uRing: { value: new Color("#b1a1e6") },
      uSun: uniforms.uSun,
      uCenter: { value: new Vector3(...position) },
      uRadius: { value: radius },
      uPresence: { value: 1 },
    }),
    [position, radius, uniforms],
  );

  useFrame(({ camera }) => {
    if (motion.current.modal || document.hidden) return;
    const travel = MathUtils.clamp(motion.current.progress - stop, -2, 2);
    if (body.current) body.current.rotation.y = travel * 0.2;
    if (ringed && axis.current) axis.current.rotation.z = lighting.tilt[2] + travel * 0.06;
    if (ringed && root.current) {
      const distance = camera.position.distanceTo(root.current.position);
      const presence = 1 - MathUtils.smoothstep(distance, 28, 42);
      for (const material of [surfaceMaterial, atmosphereMaterial, ringMaterial]) {
        if (material.current) material.current.uniforms.uPresence.value = presence;
      }
      root.current.visible = presence > 0;
    }
  });

  return (
    <group ref={root} position={position} scale={radius}>
      <group ref={axis} rotation={[...lighting.tilt]}>
        <group ref={body} scale={[1, lighting.flattening, 1]}>
          <mesh geometry={geometry.body} renderOrder={ringed ? -0.5 : 0}>
            <shaderMaterial
              ref={surfaceMaterial}
              uniforms={uniforms}
              vertexShader={planetVertex}
              fragmentShader={planetFragment}
              transparent={ringed}
            />
          </mesh>
          <mesh geometry={geometry.atmosphere} scale={kind === "contact" ? 1.02 : 1.043}>
            <shaderMaterial
              ref={atmosphereMaterial}
              uniforms={uniforms}
              vertexShader={planetVertex}
              fragmentShader={atmosphereFragment}
              side={BackSide}
              blending={AdditiveBlending}
              transparent
              depthWrite={false}
            />
          </mesh>
        </group>
        {ringed && (
          <mesh rotation-x={Math.PI / 2}>
            <ringGeometry args={[ringInner, ringOuter, 96]} />
            <shaderMaterial
              ref={ringMaterial}
              uniforms={ringUniforms}
              vertexShader={ringsVertex}
              fragmentShader={ringsFragment}
              side={DoubleSide}
              transparent
              depthWrite={false}
            />
          </mesh>
        )}
      </group>
    </group>
  );
}

export const Hall = memo(function Hall({
  stops,
  screens,
  motion,
  quality,
  reducedMotion,
  preparation,
}: {
  stops: Stop[];
  screens: Screen[];
  motion: RefObject<TourMotion>;
  quality: SceneQuality;
  reducedMotion: boolean;
  preparation: TexturePreparation;
}) {
  const { width, height } = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const [lods] = useState(makePlanetLods);
  useEffect(() => () => {
    for (const { body, atmosphere } of lods) {
      body.dispose();
      atmosphere.dispose();
    }
  }, [lods]);
  const geometry = quality.dpr < 1 ? lods[1] : lods[0];
  const [surface, setSurface] = useState<Texture>();
  useEffect(() => {
    let disposed = false;
    let cancel: (() => void) | undefined;
    const texture = new TextureLoader().load("/textures/planet-surface.png", (loaded) => {
      if (disposed) return;
      loaded.wrapS = RepeatWrapping;
      cancel = preparation.enqueue(loaded, () => setSurface(loaded));
      invalidate();
    });
    return () => {
      disposed = true;
      cancel?.();
      texture.dispose();
    };
  }, [invalidate, preparation]);
  const aspect = width / Math.max(height, 1);
  const poses = useMemo(
    () => layoutCamera(stops, screens, aspect, height),
    [stops, screens, aspect, height],
  );
  const planets = useMemo(
    () => layoutPlanets(stops, poses, aspect, height),
    [stops, poses, aspect, height],
  );
  const spacecraft = layoutSpacecraft(poses[0], aspect, height);
  const bioIndex = stops.findIndex((stop) => stop.kind === "bio");
  const toolsIndex = stops.findIndex((stop) => stop.kind === "tools");
  const bioDepth = depth(bioIndex);
  const toolsDepth = depth(toolsIndex);
  const endDepth = depth(stops.length - 1);
  return (
    <>
      <color attach="background" args={[spaceBackground]} />
      <fogExp2 attach="fog" args={[spaceBackground, 0.024]} />
      <ambientLight intensity={1.3} color="#8ca2c2" />
      <directionalLight intensity={1.8} color="#a3d5ff" position={[0, 9, 5]} />
      <Stars end={endDepth} count={quality.distantStars} />
      <Stars end={endDepth} count={quality.nearStars} near />
      {planets.map((planet) => (
        <Planet key={planet.kind} {...planet} motion={motion} surface={surface} geometry={geometry} />
      ))}
      <Spacecraft {...spacecraft} motion={motion} reducedMotion={reducedMotion} />
      {poses[bioIndex] && poses[toolsIndex] && (
        <OrbitalDetails
          astronaut={layoutOrbitalDetail(poses[bioIndex], aspect, height, "astronaut")}
          satellite={layoutOrbitalDetail(poses[toolsIndex], aspect, height, "satellite")}
          motion={motion}
          reducedMotion={reducedMotion}
        />
      )}
      <WorldBoundary>
        <Suspense fallback={null}>
          <Text
            font="/fonts/InstrumentSerif-Italic.ttf"
            fontSize={9.8}
            color="#22364f"
            position={[-1, 0.45, bioDepth - 4]}
            anchorX="center"
            fillOpacity={0.32}
          >
            SM
          </Text>
          <Text
            font="/fonts/InstrumentSerif-Italic.ttf"
            fontSize={5.2}
            color="#3e617e"
            position={[2, 1.55, toolsDepth - 5]}
            anchorX="center"
            fillOpacity={0.28}
          >
            Chiku
          </Text>
        </Suspense>
      </WorldBoundary>
    </>
  );
});
