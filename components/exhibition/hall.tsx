import { Text } from "@react-three/drei";
import { useMemo } from "react";
import { Color, type Texture } from "three";
import { tools } from "./content";
import { auraFragment, floorFragment, worldVertex } from "./shaders";
import { depth, floor } from "./world-layout";
import type { Stop } from "./types";

function buildRails(end: number) {
  const sections: number[] = [];
  const runners: number[] = [];
  const profile = [
    [-16, floor],
    [-16, 3.7],
    [-12.9, 6.8],
    [12.9, 6.8],
    [16, 3.7],
    [16, floor],
  ];
  for (let z = 15; z >= end; z -= 6) {
    for (let i = 1; i < profile.length; i++) {
      const [x1, y1] = profile[i - 1];
      const [x2, y2] = profile[i];
      sections.push(x1, y1, z, x2, y2, z);
    }
    for (const sign of [-1, 1]) {
      const x = sign * 8.7;
      sections.push(x - 0.2, floor + 0.012, z, x + 0.2, floor + 0.012, z);
      const wall = sign * 16;
      sections.push(wall, -1.8, z, wall, -0.8, z);
    }
  }
  for (const [x, y] of [
    ...profile,
    [-8.7, floor + 0.016],
    [8.7, floor + 0.016],
  ]) {
    runners.push(x, y, 20, x, y, end);
  }
  return [new Float32Array(sections), new Float32Array(runners)] as const;
}

function Segments({
  positions,
  color,
  opacity,
}: {
  positions: Float32Array;
  color: string;
  opacity: number;
}) {
  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial
        color={color}
        opacity={opacity}
        transparent
        depthWrite={false}
      />
    </lineSegments>
  );
}

function Halo({
  pos,
  size,
  color,
}: {
  pos: [number, number, number];
  size: [number, number];
  color: string;
}) {
  const uniforms = useMemo(
    () => ({ uTint: { value: new Color(color) } }),
    [color],
  );
  return (
    <mesh position={pos}>
      <planeGeometry args={size} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={worldVertex}
        fragmentShader={auraFragment}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

function Portal({
  at,
  scale = 1,
  light = "#6ed3ec",
}: {
  at: number;
  scale?: number;
  light?: string;
}) {
  const geometry = useMemo(() => {
    const outline = [
      [-12.8, floor],
      [-12.8, 4.6],
      [-10.8, 6.6],
      [10.8, 6.6],
      [12.8, 4.6],
      [12.8, floor],
    ];
    const shape: number[] = [];
    for (let i = 1; i < outline.length; i++) {
      const [x1, y1] = outline[i - 1];
      const [x2, y2] = outline[i];
      shape.push(x1 * scale, y1, at, x2 * scale, y2, at);
    }
    return new Float32Array(shape);
  }, [at, scale]);
  return <Segments positions={geometry} color={light} opacity={0.65} />;
}

export function Hall({
  stops,
  iconMaps,
}: {
  stops: Stop[];
  iconMaps: Record<string, Texture>;
}) {
  const end = depth(stops.length - 1) - 50;
  const [sections, runners] = useMemo(() => buildRails(end), [end]);
  const bioDepth = depth(stops.findIndex((stop) => stop.kind === "bio"));
  const toolsDepth = depth(stops.findIndex((stop) => stop.kind === "tools"));
  const endDepth = depth(stops.length - 1);
  return (
    <>
      <color attach="background" args={["#070a12"]} />
      <fogExp2 attach="fog" args={["#070a12", 0.024]} />
      <ambientLight intensity={1.3} color="#7f9cb7" />
      <directionalLight intensity={1.8} color="#a3d5ff" position={[0, 9, 5]} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, floor, (35 + end) / 2]}
      >
        <planeGeometry args={[86, 35 - end]} />
        <shaderMaterial
          vertexShader={worldVertex}
          fragmentShader={floorFragment}
        />
      </mesh>
      <Segments positions={sections} color="#3b6482" opacity={0.34} />
      <Segments positions={runners} color="#458aaa" opacity={0.49} />
      <Portal at={-14} />
      <Portal at={-18} scale={1.14} light="#254b6b" />
      <Halo pos={[5.2, 1.1, -16]} size={[29, 19]} color="#1d73b8" />
      <Halo pos={[-7.2, 4.6, -27]} size={[17, 13]} color="#214278" />

      <Portal at={bioDepth - 3} light="#566e8e" />
      <Portal at={toolsDepth - 3} light="#779ab7" />
      <Halo pos={[-5, 2.3, bioDepth - 3.3]} size={[32, 18]} color="#25435c" />
      <Halo pos={[5.4, 1, toolsDepth - 5]} size={[24, 17]} color="#2f5385" />
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

      <Portal at={endDepth + 1} />
      <Portal at={endDepth - 4} scale={0.84} light="#508bad" />
      <Portal at={endDepth - 9} scale={0.69} light="#416889" />
      <Portal at={endDepth - 14} scale={0.58} light="#35566f" />
      <Halo pos={[0, 0, endDepth - 12]} size={[33, 19]} color="#195372" />
    </>
  );
}
