import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { BoxGeometry, type Group } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { planetVertex } from "./shaders";
import type { TourMotion } from "./types";

const visorFragment = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vec3 n = normalize(vNormal);
    float facing = max(dot(n, normalize(vView)), 0.0);
    float reflection = smoothstep(0.15, 0.82, dot(n, vec3(-0.58, 0.73, 0.34)));
    float streak = exp(-pow((n.y + 0.32 * n.x - 0.37) * 7.4, 2.0));
    vec3 blue = vec3(0.008, 0.026, 0.060);
    vec3 copper = vec3(0.44, 0.23, 0.105);
    vec3 light = blue + copper * reflection * (0.25 + streak * 0.65);
    light += vec3(0.12, 0.31, 0.48) * pow(1.0 - facing, 3.4) * 0.63;
    gl_FragColor = vec4(light, 1.0);
    #include <colorspace_fragment>
  }
`;

const fabric = { color: "#aab6ca", emissive: "#181d31", roughness: 0.84 };
const hardware = { color: "#42536e", roughness: 0.52, metalness: 0.35 };

function Astronaut({ arm }: { arm: RefObject<Group | null> }) {
  return (
    <>
      <mesh position={[0, 0.11, 0]} scale={[1, 1, 0.76]}>
        <capsuleGeometry args={[0.37, 0.32, 5, 12]} />
        <meshStandardMaterial {...fabric} />
      </mesh>
      <mesh position={[0, 0.14, -0.28]}>
        <boxGeometry args={[0.65, 0.78, 0.37]} />
        <meshStandardMaterial {...hardware} />
      </mesh>
      <mesh position={[0, 0.21, 0.29]}>
        <boxGeometry args={[0.36, 0.29, 0.13]} />
        <meshStandardMaterial {...hardware} />
      </mesh>
      <mesh position={[0, 0.27, 0.36]}>
        <boxGeometry args={[0.22, 0.035, 0.025]} />
        <meshBasicMaterial color="#8ddbfc" />
      </mesh>
      <mesh position={[0, 0.81, 0.055]} scale={[1, 0.94, 0.95]}>
        <sphereGeometry args={[0.4, 24, 16]} />
        <meshStandardMaterial {...fabric} />
      </mesh>
      <mesh position={[0, 0.81, 0.26]} scale={[1, 0.77, 0.58]}>
        <sphereGeometry args={[0.335, 24, 16]} />
        <shaderMaterial vertexShader={planetVertex} fragmentShader={visorFragment} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.19, -0.24, 0]} rotation={[side < 0 ? -0.25 : 0.14, 0, side * 0.23]}>
          <mesh position={[0, -0.34, 0]}>
            <capsuleGeometry args={[0.146, 0.49, 4, 10]} />
            <meshStandardMaterial {...fabric} />
          </mesh>
          <mesh position={[0, -0.73, 0.07]} scale={[1, 0.73, 1.36]}>
            <sphereGeometry args={[0.17, 12, 8]} />
            <meshStandardMaterial {...hardware} />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.35, 0.37, 0]} rotation={[0.08, 0, side * 0.84]}>
          <mesh position={[0, -0.20, 0]}>
            <capsuleGeometry args={[0.125, 0.32, 4, 10]} />
            <meshStandardMaterial {...fabric} />
          </mesh>
          <group ref={side === 1 ? arm : undefined} position={[0, -0.40, 0]} rotation={[side === 1 ? 0.28 : -0.3, 0, side === 1 ? 1.2 : -0.27]}>
            <mesh position={[0, -0.17, 0]}>
              <capsuleGeometry args={[0.109, 0.26, 4, 10]} />
              <meshStandardMaterial {...fabric} />
            </mesh>
            <mesh position={[0, -0.36, 0.017]}>
              <sphereGeometry args={[0.108, 12, 8]} />
              <meshStandardMaterial {...hardware} />
            </mesh>
          </group>
        </group>
      ))}
    </>
  );
}

function Satellite() {
  const [frames, cells] = useMemo(() => {
    const frames = [-1, 1].map((side) => new BoxGeometry(1.13, 0.44, 0.10).translate(side * 0.84, 0, -0.042));
    const cells = [-1, 1].flatMap((side) => [-0.38, -0.13, 0.12].map((offset) =>
      new BoxGeometry(0.223, 0.36, 0.032).translate(side * (0.96 + offset), 0, 0.017),
    ));
    const geometry = [mergeGeometries(frames), mergeGeometries(cells)] as const;
    for (const part of [...frames, ...cells]) part.dispose();
    return geometry;
  }, []);
  useEffect(() => () => {
    frames.dispose();
    cells.dispose();
  }, [frames, cells]);

  return (
    <>
      <mesh rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.23, 0.28, 0.6, 8]} />
        <meshStandardMaterial {...hardware} color="#77849c" />
      </mesh>
      <mesh position={[0, 0.24, 0.05]}>
        <cylinderGeometry args={[0.04, 0.04, 0.37, 8]} />
        <meshStandardMaterial {...hardware} />
      </mesh>
      <mesh position={[0, 0.43, 0.08]} rotation-x={0.54}>
        <cylinderGeometry args={[0.27, 0.17, 0.095, 12]} />
        <meshStandardMaterial {...fabric} />
      </mesh>
      <mesh position={[0, 0.47, 0.13]} scale-y={0.8}>
        <sphereGeometry args={[0.049, 10, 8]} />
        <meshBasicMaterial color="#d9ddff" />
      </mesh>
      <mesh geometry={frames}>
        <meshStandardMaterial {...hardware} />
      </mesh>
      <mesh geometry={cells}>
        <meshStandardMaterial color="#415798" emissive="#25355c" metalness={0.42} roughness={0.45} />
      </mesh>
    </>
  );
}

type Placement = { position: [number, number, number]; scale: number };

export function OrbitalDetails({ astronaut, satellite, motion, reducedMotion }: {
  astronaut: Placement;
  satellite: Placement;
  motion: RefObject<TourMotion>;
  reducedMotion: boolean;
}) {
  const pilot = useRef<Group>(null);
  const arm = useRef<Group>(null);
  const relay = useRef<Group>(null);

  useFrame(({ camera }) => {
    if (
      !pilot.current || !relay.current || !arm.current ||
      document.hidden || motion.current.modal
    ) return;
    const pilotDistance = camera.position.z - astronaut.position[2];
    const relayDistance = camera.position.z - satellite.position[2];
    pilot.current.visible = pilotDistance > -2 && pilotDistance < 42;
    relay.current.visible = relayDistance > -2 && relayDistance < 39;
    if (!pilot.current.visible && !relay.current.visible) return;
    const time = reducedMotion ? 0 : performance.now() / 1000;
    const float = Math.sin(time * 1.18);
    const pointer = reducedMotion ? 0 : motion.current.pointerX;
    pilot.current.position.set(0.24 * Math.sin(time * 0.72), float * 0.17, 0);
    pilot.current.rotation.set(
      0.11 + float * 0.10,
      -0.32 + 0.17 * float + pointer * 0.12,
      -0.33 + float * 0.10,
    );
    arm.current.rotation.z = 1.34 + 0.2 * Math.sin(time * 2.6);
    relay.current.position.y = Math.sin(time * 0.96 + 1.2) * 0.16;
    relay.current.rotation.set(
      0.27 + float * 0.14,
      -0.32 + 0.55 * Math.sin(time * 0.63),
      -0.33 + float * 0.12,
    );
  });

  return (
    <>
      <group position={astronaut.position} scale={astronaut.scale}>
        <group ref={pilot}>
          <Astronaut arm={arm} />
        </group>
      </group>
      <group position={satellite.position} scale={satellite.scale}>
        <group ref={relay}>
          <Satellite />
        </group>
      </group>
    </>
  );
}
