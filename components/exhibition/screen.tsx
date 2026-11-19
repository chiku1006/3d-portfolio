"use client";

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Color,
  Float32BufferAttribute,
  MathUtils,
  Mesh,
  PlaneGeometry,
  SRGBColorSpace,
  Vector2,
  VideoTexture,
  type Group,
  type ShaderMaterial,
  type Texture,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { ExhibitMedia } from "./types";
import type { Screen } from "./world-layout";
import { screenFragment, worldVertex } from "./shaders";

const hoverQuery = "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

function crop(aspect: number, width: number, height: number) {
  const ratio = width / Math.max(height, 1);
  return new Vector2(Math.min(1, aspect / ratio), Math.min(1, ratio / aspect));
}

type Preview = {
  clip: HTMLVideoElement;
  texture: VideoTexture;
  frame: number;
  timer: number;
  ready: boolean;
};

function pausePreview(preview: Preview) {
  preview.clip.pause();
  preview.clip.cancelVideoFrameCallback?.(preview.frame);
  window.clearInterval(preview.timer);
}

function release(preview: Preview) {
  pausePreview(preview);
  preview.clip.removeAttribute("src");
  preview.clip.load();
  preview.texture.dispose();
}

function makeTrim(width: number, height: number, reel: boolean) {
  const border = new PlaneGeometry(width + 0.075, height + 0.075).translate(0, 0, -0.012);
  const marker = new PlaneGeometry(width * 0.12, 0.026).translate(-width * 0.43, height / 2 + 0.065, 0.007);
  for (const [geometry, tint] of [[border, reel ? "#87d8ed" : "#46667d"], [marker, "#a0edff"]] as const) {
    const colour = new Color(tint);
    const colours = Array.from({ length: 4 }, () => colour.toArray()).flat();
    geometry.setAttribute("color", new Float32BufferAttribute(colours, 3));
  }
  const geometry = mergeGeometries([border, marker]);
  border.dispose();
  marker.dispose();
  return geometry;
}

export const MediaScreen = memo(function MediaScreen({
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
  const focus = useRef(0);
  const shaderRef = useRef<ShaderMaterial>(null);
  const clipRef = useRef<Preview | null>(null);
  const invalidate = useThree((state) => state.invalidate);
  const canvas = useThree((state) => state.gl.domElement);
  const [hovered, setHovered] = useState(false);
  const previewActive = hovered && interactive && Boolean(poster) && screen.item.videoAvailable;
  const trim = useMemo(() => makeTrim(screen.width, screen.height, screen.reel), [screen.width, screen.height, screen.reel]);
  useEffect(() => () => trim.dispose(), [trim]);
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
      uOpacity: { value: 1 },
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
      const preview: Preview = { clip, texture, frame: 0, timer: 0, ready: false };
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
          if (clip.requestVideoFrameCallback) {
            preview.frame = clip.requestVideoFrameCallback(nextFrame);
          } else {
            let previousTime = clip.currentTime;
            preview.timer = window.setInterval(() => {
              if (clip.paused || clip.currentTime === previousTime) return;
              previousTime = clip.currentTime;
              invalidate();
            }, 1000 / 30);
          }
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
      if (preview) pausePreview(preview);
      invalidate();
    };
  }, [aspect, dispose, invalidate, previewActive, screen.item.videoSrc]);

  useEffect(() => dispose, [dispose]);

  useEffect(() => {
    if (!hovered) return;
    const preference = window.matchMedia(hoverQuery);
    const stop = () => setHovered(false);
    const onVisibility = () => {
      if (document.hidden) stop();
    };
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", onVisibility);
    preference.addEventListener("change", stop);
    return () => {
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", onVisibility);
      preference.removeEventListener("change", stop);
    };
  }, [hovered]);

  useEffect(() => {
    if (!previewActive) return;
    canvas.classList.add("is-interactive");
    return () => {
      canvas.classList.remove("is-interactive");
    };
  }, [canvas, previewActive]);

  useFrame(({ camera }, dt) => {
    const frame = group.current;
    if (!frame) return;
    const focusTarget = Number(focused);
    focus.current = MathUtils.damp(focus.current, focusTarget, 16, dt);
    const distance = camera.position.z - frame.position.z;
    const opacity = Math.max(focus.current, 1 - MathUtils.smoothstep(distance, 28, 48));
    frame.visible = opacity > 0.003;
    for (const child of frame.children) {
      if (child instanceof Mesh && !Array.isArray(child.material)) {
        child.material.opacity = opacity;
      }
    }
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
    current.uniforms.uOpacity.value = opacity;
    if (!previewActive && preview && blend < 0.012) dispose();
    if (
      Math.abs(blend - target) > 0.003 ||
      Math.abs(focus.current - focusTarget) > 0.003
    )
      invalidate();

    const yaw = screen.yaw + (previewActive ? -screen.side * 0.04 : 0);
    const z = screen.z + (previewActive ? 0.22 : 0);
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
          transparent
        />
      </mesh>
      <mesh geometry={trim}>
        <meshBasicMaterial vertexColors toneMapped={false} transparent />
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
            transparent
          />
        ) : (
          <meshBasicMaterial color="#102030" transparent />
        )}
      </mesh>
    </group>
  );
});
