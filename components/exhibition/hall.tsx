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
  planetFragment,
  planetVertex,
  ringsFragment,
  ringsVertex,
  starsFragment,
  starsVertex,
} from "./shaders";
import {
  depth,
  layoutCamera,
  layoutPlanets,
  type PlanetPlacement,
  type Screen,
} from "./world-layout";
import type { Stop, TourMotion } from "./types";

const space = "#050812";
const planetLighting = {
  arrival: {
    night: "#090e1b",
    day: "#3c5b7e",
    rim: "#77b9f4",
    sun: [-0.73, 0.64, 0.04],
  },
  flow: {
    night: "#110d20",
    day: "#6c4e86",
    rim: "#987bc8",
    sun: [-0.63, 0.68, 0.34],
  },
  contact: {
    night: "#080e1c",
    day: "#324963",
    rim: "#5e9aca",
    sun: [-0.19, 0.95, -0.23],
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
}: PlanetPlacement & { motion: RefObject<TourMotion> }) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const rings = useRef<Group>(null);
  const surfaceMaterial = useRef<ShaderMaterial>(null);
  const atmosphereMaterial = useRef<ShaderMaterial>(null);
  const ringMaterial = useRef<ShaderMaterial>(null);
  const lighting = planetLighting[kind];
  const uniforms = useMemo(
    () => ({
      uNight: { value: new Color(lighting.night) },
      uDay: { value: new Color(lighting.day) },
      uRim: { value: new Color(lighting.rim) },
      uSun: { value: new Vector3(...lighting.sun).normalize() },
      uBands: { value: Number(kind === "flow") },
      uPresence: { value: 1 },
    }),
    [kind, lighting],
  );
  const ringUniforms = useMemo(
    () => ({
      uRing: { value: new Color("#a38ac9") },
      uPresence: { value: 1 },
    }),
    [],
  );

  useFrame(({ camera }) => {
    if (motion.current.modal || document.hidden) return;
    const travel = MathUtils.clamp(motion.current.progress - stop, -2, 2);
    if (body.current) body.current.rotation.y = travel * 0.2;
    if (rings.current) rings.current.rotation.z = -0.29 + travel * 0.06;
    if (kind === "flow" && root.current) {
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
      <group ref={body} rotation={[0, 0, 0.19]}>
        <mesh renderOrder={kind === "flow" ? -0.5 : 0}>
          <sphereGeometry args={[1, 56, 40]} />
          <shaderMaterial
            ref={surfaceMaterial}
            uniforms={uniforms}
            vertexShader={planetVertex}
            fragmentShader={planetFragment}
            transparent={kind === "flow"}
          />
        </mesh>
        <mesh scale={kind === "contact" ? 1.016 : 1.045}>
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
      {kind === "flow" && (
        <group ref={rings}>
          <mesh rotation={[1.17, 0.12, 0]}>
            <ringGeometry args={[1.22, 1.98, 80]} />
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
        </group>
      )}
    </group>
  );
}

export function Hall({
  stops,
  screens,
  motion,
  iconMaps,
}: {
  stops: Stop[];
  screens: Screen[];
  motion: RefObject<TourMotion>;
  iconMaps: Record<string, Texture>;
}) {
  const aspect = useThree(({ size }) => size.width / Math.max(size.height, 1));
  const planets = useMemo(
    () => layoutPlanets(stops, layoutCamera(stops, screens, aspect), aspect),
    [stops, screens, aspect],
  );
  const bioDepth = depth(stops.findIndex((stop) => stop.kind === "bio"));
  const toolsDepth = depth(stops.findIndex((stop) => stop.kind === "tools"));
  const endDepth = depth(stops.length - 1);
  return (
    <>
      <color attach="background" args={[space]} />
      <fogExp2 attach="fog" args={[space, 0.024]} />
      <ambientLight intensity={1.3} color="#7f9cb7" />
      <directionalLight intensity={1.8} color="#a3d5ff" position={[0, 9, 5]} />
      <Stars end={endDepth} />
      <Stars end={endDepth} near />
      {planets.map((planet) => (
        <Planet key={planet.kind} {...planet} motion={motion} />
      ))}
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
                map={iconMaps[icon]}
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
