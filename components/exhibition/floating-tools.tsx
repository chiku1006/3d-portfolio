import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import { Color, type Group, type Texture } from "three";
import { tools } from "./content";
import { worldVertex } from "./shaders";
import type { TourMotion } from "./types";

const haloFragment = /* glsl */ `
  uniform vec3 uRim;
  varying vec2 vUv;

  void main() {
    float feather = 1.0 - smoothstep(0.13, 0.50, length(vUv - 0.5));
    gl_FragColor = vec4(uRim, feather * feather * 0.17);
    #include <colorspace_fragment>
  }
`;

type Position = [number, number, number];

const staggeredPositions: Position[] = [
  [-1.12, -0.92, 0.14],
  [0.86, -0.66, -0.20],
  [-0.91, 0.88, -0.30],
  [1.02, 0.98, -0.88],
];

function ToolBadge({ index, position, texture, rim, motion }: {
  index: number;
  position: Position;
  texture: Texture;
  rim: string;
  motion: RefObject<TourMotion>;
}) {
  const tile = useRef<Group>(null);
  const halo = useMemo(() => ({ uRim: { value: new Color(rim) } }), [rim]);
  const direction = index % 2 === 0 ? 1 : -1;

  useFrame(() => {
    const badge = tile.current;
    if (!badge || document.hidden || motion.current.modal) return;
    const phase = performance.now() * 0.0012 + index * 1.6;
    const drift = Math.sin(phase);
    badge.position.set(
      position[0] + 0.095 * Math.cos(phase * 0.72),
      position[1] + drift * 0.13,
      position[2] + Math.cos(phase) * 0.10,
    );
    badge.rotation.set(
      0.16 + 0.10 * Math.cos(phase * 0.70),
      direction * 0.29 + 0.13 * drift + motion.current.pointerX * 0.11,
      direction * 0.14 + 0.06 * drift,
    );
  });

  return (
    <group ref={tile} position={position}>
      <mesh position={[0, 0, -0.14]}>
        <planeGeometry args={[2.05, 2.05]} />
        <shaderMaterial
          uniforms={halo}
          vertexShader={worldVertex}
          fragmentShader={haloFragment}
          transparent
          depthWrite={false}
        />
      </mesh>
      <RoundedBox
        args={[1.28, 1.28, 0.24]}
        radius={0.085}
        smoothness={3}
        bevelSegments={2}
      >
        <meshStandardMaterial
          color={rim}
          emissive={rim}
          emissiveIntensity={0.16}
          metalness={0.55}
          roughness={0.35}
        />
      </RoundedBox>
      <RoundedBox
        args={[1.16, 1.16, 0.07]}
        position={[0, 0, 0.106]}
        radius={0.028}
        smoothness={3}
        bevelSegments={2}
      >
        <meshStandardMaterial color="#12182b" metalness={0.32} roughness={0.44} />
      </RoundedBox>
      <mesh position={[0, 0, 0.145]}>
        <planeGeometry args={[1.04, 1.04]} />
        <meshBasicMaterial map={texture} alphaTest={0.10} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function FloatingTools({ position, scale, compact, motion, maps }: {
  position: Position;
  scale: number;
  compact: boolean;
  motion: RefObject<TourMotion>;
  maps: Record<string, Texture>;
}) {
  const cluster = useRef<Group>(null);
  useFrame(({ camera }) => {
    if (cluster.current) cluster.current.visible = camera.position.z - position[2] < 38;
  });

  return (
    <group ref={cluster} position={position} scale={scale}>
      {tools.map(({ icon, rim }, index) => (
        <ToolBadge
          key={icon}
          index={index}
          position={
            compact
              ? [(index - 1.5) * 1.58, index % 2 === 0 ? 0.18 : 0, -index * 0.11]
              : staggeredPositions[index]
          }
          texture={maps[icon]}
          rim={rim}
          motion={motion}
        />
      ))}
    </group>
  );
}
