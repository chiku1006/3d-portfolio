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
import { tools } from "./content";
import {
  atmosphereFragment,
  cloudsFragment,
  planetFragment,
  planetVertex,
  ringsFragment,
  ringsVertex,
  saturnRingInner,
  saturnRingOuter,
  spaceBackground,
  starsFragment,
  starsVertex,
} from "./shaders";
import { Spacecraft } from "./spacecraft";
import {
  depth,
  layoutCamera,
  layoutPlanets,
  layoutSpacecraft,
  type PlanetPlacement,
  type Screen,
} from "./world-layout";
import type { Stop, TourMotion } from "./types";

export const planetTextures = {
  earth: "/textures/planets/earth.webp",
  clouds: "/textures/planets/earth-clouds.webp",
  saturn: "/textures/planets/saturn.webp",
  rings: "/textures/planets/2k_saturn_ring_alpha.png",
  jupiter: "/textures/planets/jupiter.webp",
} as const;

const planetLighting = {
  arrival: {
    map: planetTextures.earth,
    rim: "#64b7ff",
    sun: [-0.78, 0.46, 0.45],
    exposure: 0.67,
    tilt: [0, 0, 0.19],
    longitude: -2.43,
    flattening: 1,
  },
  flow: {
    map: planetTextures.saturn,
    rim: "#c1a47c",
    sun: [-0.61, 0.64, 0.46],
    exposure: 0.42,
    tilt: [-0.4, 0, -0.29],
    longitude: 0,
    flattening: 0.91,
  },
  contact: {
    map: planetTextures.jupiter,
    rim: "#bc9c81",
    sun: [-0.77, 0.59, 0.21],
    exposure: 0.40,
    tilt: [1.23, 0, 0.19],
    longitude: -1.4,
    flattening: 0.98,
  },
} as const;

function scatterStars(near: boolean, end: number) {
  const count = near ? 630 : 1900;
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
    appearance[i * 2] = random() ** 2.8;
    appearance[i * 2 + 1] = random() ** 2;
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
  maps,
}: PlanetPlacement & { motion: RefObject<TourMotion>; maps: Record<string, Texture> }) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const axis = useRef<Group>(null);
  const surfaceMaterial = useRef<ShaderMaterial>(null);
  const atmosphereMaterial = useRef<ShaderMaterial>(null);
  const ringMaterial = useRef<ShaderMaterial>(null);
  const lighting = planetLighting[kind];
  const saturn = kind === "flow";
  const uniforms = useMemo(
    () => ({
      uSurface: { value: maps[lighting.map] },
      uClouds: { value: maps[planetTextures.clouds] },
      uRim: { value: new Color(lighting.rim) },
      uSun: { value: new Vector3(...lighting.sun).normalize() },
      uExposure: { value: lighting.exposure },
      uPresence: { value: 1 },
    }),
    [lighting, maps],
  );
  const ringUniforms = useMemo(
    () => ({
      uRingMap: { value: maps[planetTextures.rings] },
      uSun: uniforms.uSun,
      uCenter: { value: new Vector3(...position) },
      uRadius: { value: radius },
      uPresence: { value: 1 },
    }),
    [maps, position, radius, uniforms],
  );

  useFrame(({ camera }) => {
    if (motion.current.modal || document.hidden) return;
    const travel = MathUtils.clamp(motion.current.progress - stop, -2, 2);
    if (body.current) body.current.rotation.y = lighting.longitude + travel * 0.2;
    if (saturn && axis.current) axis.current.rotation.z = lighting.tilt[2] + travel * 0.06;
    if (saturn && root.current) {
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
        <group ref={body} rotation-y={lighting.longitude} scale={[1, lighting.flattening, 1]}>
          <mesh renderOrder={saturn ? -0.5 : 0}>
            <sphereGeometry args={[1, 64, 48]} />
            <shaderMaterial
              ref={surfaceMaterial}
              uniforms={uniforms}
              vertexShader={planetVertex}
              fragmentShader={planetFragment}
              transparent={saturn}
            />
          </mesh>
          {kind === "arrival" && (
            <mesh scale={1.008} rotation-y={0.09}>
              <sphereGeometry args={[1, 56, 40]} />
              <shaderMaterial uniforms={uniforms} vertexShader={planetVertex} fragmentShader={cloudsFragment} transparent depthWrite={false} />
            </mesh>
          )}
          <mesh scale={kind === "arrival" ? 1.035 : 1.014}>
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
        {saturn && (
          <mesh rotation-x={Math.PI / 2}>
            <ringGeometry args={[saturnRingInner, saturnRingOuter, 96]} />
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
  const bioDepth = depth(stops.findIndex((stop) => stop.kind === "bio"));
  const toolsDepth = depth(stops.findIndex((stop) => stop.kind === "tools"));
  const endDepth = depth(stops.length - 1);
  return (
    <>
      <color attach="background" args={[spaceBackground]} />
      <fogExp2 attach="fog" args={[spaceBackground, 0.024]} />
      <ambientLight intensity={1.3} color="#7f9cb7" />
      <directionalLight intensity={1.8} color="#a3d5ff" position={[0, 9, 5]} />
      <Stars end={endDepth} />
      <Stars end={endDepth} near />
      {planets.map((planet) => (
        <Planet key={planet.kind} {...planet} motion={motion} maps={maps} />
      ))}
      <Spacecraft {...spacecraft} nearby={active < 2} motion={motion} />
      <Text
        font="/fonts/InstrumentSerif-Italic.ttf"
        fontSize={9.8}
        color="#22364f"
        position={[-1, 0.45, bioDepth - 4]}
        anchorX="center"
        fillOpacity={0.55}
      >
        SM
      </Text>
      <Text
        font="/fonts/InstrumentSerif-Italic.ttf"
        fontSize={5.2}
        color="#3e617e"
        position={[2, 1.55, toolsDepth - 5]}
        anchorX="center"
        fillOpacity={0.43}
      >
        Chiku
      </Text>
      <group position={[6.3, -0.7, toolsDepth - 1]}>
        {tools.map(({ icon }, i) => (
          <group
            key={icon}
            position={[(i % 2) * 1.3, Math.floor(i / 2) * 1.3, i * -0.16]}
          >
            <mesh>
              <boxGeometry args={[1.12, 1.12, 0.16]} />
              <meshStandardMaterial
                color="#172337"
                roughness={0.42}
                metalness={0.48}
              />
            </mesh>
            <mesh position={[0, 0, 0.09]}>
              <planeGeometry args={[0.69, 0.69]} />
              <meshBasicMaterial
                map={maps[icon]}
                transparent
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}
      </group>
    </>
  );
}
