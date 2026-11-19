import { Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  MathUtils,
  Vector3,
  type Group,
  type ShaderMaterial,
  type Texture,
} from "three";
import { FloatingTools } from "./floating-tools";
import {
  atmosphereFragment,
  nebulaFragment,
  nebulaVertex,
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
import {
  depth,
  layoutCamera,
  layoutOrbitalDetail,
  layoutPlanets,
  layoutSpacecraft,
  layoutToolTiles,
  type PlanetPlacement,
  type Screen,
} from "./world-layout";
import type { Stop, TourMotion } from "./types";

const skyUniforms = { uSpace: { value: new Color(spaceBackground) } };

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

function scatterStars(near: boolean, end: number) {
  const count = near ? 1240 : 4850;
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

function Stars({ near = false, end }: { near?: boolean; end: number }) {
  const dpr = useThree((state) => state.viewport.dpr);
  const { positions, appearance } = useMemo(
    () => scatterStars(near, end),
    [near, end],
  );
  const uniforms = useMemo(
    () => ({ uDpr: { value: dpr }, uNearLayer: { value: Number(near) } }),
    [dpr, near],
  );
  return (
    <points frustumCulled={near} renderOrder={near ? 1 : -1}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute
          attach="attributes-aAppearance"
          args={[appearance, 2]}
        />
      </bufferGeometry>
      <shaderMaterial
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
}: PlanetPlacement & { motion: RefObject<TourMotion> }) {
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
    }),
    [lighting],
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
          <mesh renderOrder={ringed ? -0.5 : 0}>
            <sphereGeometry args={[1, 64, 48]} />
            <shaderMaterial
              ref={surfaceMaterial}
              uniforms={uniforms}
              vertexShader={planetVertex}
              fragmentShader={planetFragment}
              transparent={ringed}
            />
          </mesh>
          <mesh scale={kind === "contact" ? 1.02 : 1.043}>
            <sphereGeometry args={[1, 56, 40]} />
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

export function Hall({
  stops,
  screens,
  motion,
  maps,
  active,
}: {
  stops: Stop[];
  screens: Screen[];
  motion: RefObject<TourMotion>;
  maps: Record<string, Texture>;
  active: number;
}) {
  const { width, height } = useThree((state) => state.size);
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
      <mesh position={[0, 0, endDepth * 0.5]} frustumCulled={false} renderOrder={-10}>
        <sphereGeometry args={[1800, 28, 18]} />
        <shaderMaterial
          uniforms={skyUniforms}
          vertexShader={nebulaVertex}
          fragmentShader={nebulaFragment}
          side={BackSide}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <ambientLight intensity={1.3} color="#8ca2c2" />
      <directionalLight intensity={1.8} color="#a3d5ff" position={[0, 9, 5]} />
      <Stars end={endDepth} />
      <Stars end={endDepth} near />
      {planets.map((planet) => (
        <Planet key={planet.kind} {...planet} motion={motion} />
      ))}
      <Spacecraft {...spacecraft} nearby={active < 2} motion={motion} />
      {poses[bioIndex] && poses[toolsIndex] && (
        <OrbitalDetails
          astronaut={layoutOrbitalDetail(poses[bioIndex], aspect, height, "astronaut")}
          satellite={layoutOrbitalDetail(poses[toolsIndex], aspect, height, "satellite")}
          nearby={active === bioIndex || active === toolsIndex}
          motion={motion}
        />
      )}
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
      {poses[toolsIndex] && (
        <FloatingTools
          {...layoutToolTiles(poses[toolsIndex], aspect, height)}
          maps={maps}
          motion={motion}
        />
      )}
    </>
  );
}
