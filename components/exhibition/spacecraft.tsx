import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import { Shape, type Group } from "three";
import type { TourMotion } from "./types";

const wingExtrusion = {
  depth: 0.065,
  bevelEnabled: true,
  bevelSegments: 1,
  bevelSize: 0.025,
  bevelThickness: 0.025,
};

export function Spacecraft({
  position,
  scale,
  motion,
  reducedMotion,
}: {
  position: [number, number, number];
  scale: number;
  motion: RefObject<TourMotion>;
  reducedMotion: boolean;
}) {
  const flight = useRef<Group>(null);
  const exhaust = useRef<Group>(null);
  const wing = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(0.16, 0.35);
    shape.lineTo(0.59, 0.04);
    shape.lineTo(1.24, -0.63);
    shape.lineTo(1.1, -0.81);
    shape.lineTo(0.39, -0.62);
    shape.lineTo(0.16, -0.73);
    shape.closePath();
    return shape;
  }, []);

  useFrame(({ camera }) => {
    if (!flight.current || !exhaust.current || document.hidden || motion.current.modal) return;
    const distance = camera.position.z - position[2];
    flight.current.visible = distance > -2 && distance < 64;
    if (!flight.current.visible) return;
    const time = reducedMotion ? 0 : performance.now() / 1000;
    const drift = Math.sin(time * 0.85);
    const travel = Math.min(motion.current.progress, 2);
    flight.current.position.set(drift * 0.44 + travel * 0.55, Math.sin(time * 1.1) * 0.18 + travel * 0.27, 0);
    flight.current.rotation.set(0.43 + drift * 0.14, -0.26, -0.76 - drift * 0.09);
    exhaust.current.scale.y = 0.85 + 0.15 * Math.sin(time * 13);
  });

  return (
    <group position={position} scale={scale}>
      <group ref={flight}>
        <mesh>
          <cylinderGeometry args={[0.13, 0.34, 1.43, 8]} />
          <meshStandardMaterial color="#8298ac" metalness={0.38} roughness={0.48} />
        </mesh>
        <mesh position={[0, 0.89, 0]}>
          <coneGeometry args={[0.13, 0.36, 8]} />
          <meshStandardMaterial color="#b1bfcc" metalness={0.27} roughness={0.46} />
        </mesh>
        <mesh position={[0, 0.29, 0.17]} scale={[0.14, 0.31, 0.105]}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color="#275875" emissive="#0f334c" metalness={0.52} roughness={0.31} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side} scale={[side, 1, 1]}>
            <mesh position={[0, 0, -0.06]}>
              <extrudeGeometry args={[wing, wingExtrusion]} />
              <meshStandardMaterial color="#536c83" metalness={0.43} roughness={0.52} />
            </mesh>
            <mesh position={[0.46, -0.41, 0.025]} rotation={[0, 0, 0.64]}>
              <boxGeometry args={[0.065, 0.47, 0.034]} />
              <meshStandardMaterial color="#91a8b9" metalness={0.31} roughness={0.53} />
            </mesh>
            <mesh position={[0.3, -0.62, -0.025]}>
              <cylinderGeometry args={[0.115, 0.16, 0.49, 9]} />
              <meshStandardMaterial color="#253645" metalness={0.58} roughness={0.44} />
            </mesh>
            <mesh position={[0.3, -0.87, -0.025]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.099, 0.022, 5, 12]} />
              <meshBasicMaterial color="#58d1ec" />
            </mesh>
            <mesh position={[1.12, -0.66, 0.043]}>
              <sphereGeometry args={[0.047, 7, 5]} />
              <meshBasicMaterial color={side < 0 ? "#ed9063" : "#96e6dd"} />
            </mesh>
          </group>
        ))}
        <group ref={exhaust} position={[0, -0.87, -0.025]}>
          {[-0.3, 0.3].map((x) => (
            <mesh key={x} position={[x, -0.20, 0]} rotation={[0, 0, Math.PI]}>
              <coneGeometry args={[0.086, 0.43, 9]} />
              <meshBasicMaterial color="#58c9f5" opacity={0.35} transparent depthWrite={false} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}
