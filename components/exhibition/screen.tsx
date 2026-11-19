"use client";

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Color,
  MathUtils,
  SRGBColorSpace,
  Vector2,
  VideoTexture,
  type Group,
  type ShaderMaterial,
  type Texture,
} from "three";
import type { ExhibitMedia } from "./types";
import type { Screen } from "./world-layout";
import { screenFragment, spaceBackground, worldVertex } from "./shaders";

const hoverQuery = "(hover: hover) and (pointer: fine)";

function crop(aspect: number, width: number, height: number) {
  const ratio = width / Math.max(height, 1);
  return new Vector2(Math.min(1, aspect / ratio), Math.min(1, ratio / aspect));
}

type Preview = {
  clip: HTMLVideoElement;
  texture: VideoTexture;
  frame: number;
  ready: boolean;
};

function release(preview: Preview) {
  preview.clip.pause();
  preview.clip.cancelVideoFrameCallback?.(preview.frame);
  preview.clip.removeAttribute("src");
  preview.clip.load();
  preview.texture.dispose();
}

export function MediaScreen({
  screen,
  poster,
  focused,
  interactive,
  onOpen,
}: {
  screen: Screen;
  poster: Texture | undefined;
  focused: boolean;
  interactive: boolean;
  onOpen: (item: ExhibitMedia) => void;
}) {
  const group = useRef<Group>(null);
  const shaderRef = useRef<ShaderMaterial>(null);
  const clipRef = useRef<Preview | null>(null);
  const invalidate = useThree((state) => state.invalidate);
  const canvas = useThree((state) => state.gl.domElement);
  const [hovered, setHovered] = useState(false);
  const previewActive = hovered && interactive && screen.item.videoAvailable;
  const aspect = screen.width / screen.height;
  const image = poster?.image as HTMLImageElement | undefined;
  const uniforms = useMemo(
    () => ({
      uPoster: { value: poster ?? (null as Texture | null) },
      uVideo: { value: poster ?? (null as Texture | null) },
      uPosterCrop: {
        value: crop(aspect, image?.width ?? 1, image?.height ?? 1),
      },
      uVideoCrop: { value: new Vector2(1, 1) },
      uVideoMix: { value: 0 },
      uSpace: { value: new Color(spaceBackground) },
      uFocus: { value: 0 },
    }),
    [poster, aspect, image],
  );

  const dispose = useCallback(() => {
    const preview = clipRef.current;
    if (!preview) return;
    clipRef.current = null;
    release(preview);
    const current = shaderRef.current;
    if (current) {
      current.uniforms.uVideo.value = poster ?? null;
      current.uniforms.uVideoMix.value = 0;
    }
  }, [poster]);

  useEffect(() => {
    if (!previewActive) return;
    const timer = window.setTimeout(() => {
      dispose();
      const clip = document.createElement("video");
      clip.muted = true;
      clip.loop = true;
      clip.playsInline = true;
      clip.preload = "none";
      const texture = new VideoTexture(clip);
      texture.colorSpace = SRGBColorSpace;
      const preview: Preview = { clip, texture, frame: 0, ready: false };
      clipRef.current = preview;
      const nextFrame = () => {
        if (clipRef.current !== preview || clip.paused) return;
        invalidate();
        preview.frame = clip.requestVideoFrameCallback(nextFrame);
      };
      clip.addEventListener(
        "playing",
        () => {
          if (clipRef.current !== preview) return;
          const current = shaderRef.current;
          if (!current) return;
          current.uniforms.uVideo.value = texture;
          current.uniforms.uVideoCrop.value = crop(
            aspect,
            clip.videoWidth,
            clip.videoHeight,
          );
          preview.ready = true;
          if (clip.requestVideoFrameCallback)
            preview.frame = clip.requestVideoFrameCallback(nextFrame);
          invalidate();
        },
        { once: true },
      );
      clip.src = screen.item.videoSrc;
      void clip.play().catch(() => {
        if (clipRef.current === preview) dispose();
      });
    }, 150);
    return () => {
      window.clearTimeout(timer);
      const preview = clipRef.current;
      if (preview) {
        preview.clip.pause();
        preview.clip.cancelVideoFrameCallback?.(preview.frame);
      }
      invalidate();
    };
  }, [aspect, dispose, invalidate, previewActive, screen.item.videoSrc]);

  useEffect(() => dispose, [dispose]);

  useEffect(() => {
    if (!hovered) return;
    const stop = () => setHovered(false);
    const onVisibility = () => {
      if (document.hidden) stop();
    };
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [hovered]);

  useEffect(() => {
    if (!previewActive) return;
    canvas.classList.add("is-interactive");
    return () => {
      canvas.classList.remove("is-interactive");
    };
  }, [canvas, previewActive]);

  useFrame((_, dt) => {
    const preview = clipRef.current;
    const target = Number(previewActive && Boolean(preview?.ready));
    const current = shaderRef.current;
    if (!current) {
      if (preview) dispose();
      return;
    }
    const blend = MathUtils.damp(
      current.uniforms.uVideoMix.value,
      target,
      18,
      dt,
    );
    current.uniforms.uVideoMix.value = blend;
    const focus = MathUtils.damp(current.uniforms.uFocus.value, Number(focused), 16, dt);
    current.uniforms.uFocus.value = focus;
    if (!previewActive && preview && blend < 0.012) dispose();
    if (
      Math.abs(blend - target) > 0.003 ||
      Math.abs(focus - Number(focused)) > 0.003 ||
      (previewActive &&
        preview?.ready &&
        !preview.clip.requestVideoFrameCallback)
    )
      invalidate();

    if (!group.current) return;
    const yaw = screen.yaw + (previewActive ? -screen.side * 0.04 : 0);
    const z = screen.z + (previewActive ? 0.22 : 0);
    const frame = group.current;
    frame.rotation.y = MathUtils.damp(frame.rotation.y, yaw, 12, dt);
    frame.position.z = MathUtils.damp(frame.position.z, z, 12, dt);
    if (
      Math.abs(frame.position.z - z) > 0.002 ||
      Math.abs(frame.rotation.y - yaw) > 0.001
    )
      invalidate();
  });

  function enter(event: ThreeEvent<PointerEvent>) {
    if (
      !interactive ||
      event.nativeEvent.pointerType !== "mouse" ||
      !window.matchMedia(hoverQuery).matches
    )
      return;
    event.stopPropagation();
    setHovered(true);
  }

  return (
    <group
      ref={group}
      position={[screen.x, screen.y, screen.z]}
      rotation={[0, screen.yaw, 0]}
    >
      <mesh position={[0, 0, -0.12]}>
        <boxGeometry args={[screen.width + 0.18, screen.height + 0.18, 0.19]} />
        <meshStandardMaterial
          color="#122131"
          metalness={0.62}
          roughness={0.51}
        />
      </mesh>
      <mesh position={[0, 0, -0.012]}>
        <planeGeometry args={[screen.width + 0.075, screen.height + 0.075]} />
        <meshBasicMaterial color={screen.reel ? "#87d8ed" : "#46667d"} />
      </mesh>
      <mesh
        onPointerOver={enter}
        onPointerOut={() => setHovered(false)}
        onClick={(event) => {
          if (!interactive || !screen.item.videoAvailable || event.delta > 7)
            return;
          event.stopPropagation();
          setHovered(false);
          onOpen(screen.item);
        }}
      >
        <planeGeometry args={[screen.width, screen.height]} />
        {poster ? (
          <shaderMaterial
            ref={shaderRef}
            uniforms={uniforms}
            vertexShader={worldVertex}
            fragmentShader={screenFragment}
          />
        ) : (
          <meshBasicMaterial color="#102030" />
        )}
      </mesh>
      <mesh position={[-screen.width * 0.43, screen.height / 2 + 0.065, 0.007]}>
        <planeGeometry args={[screen.width * 0.12, 0.026]} />
        <meshBasicMaterial color="#a0edff" toneMapped={false} />
      </mesh>
    </group>
  );
}
