/* Ported from dev-sufyaan/Portfolio-Pitch-Black-Swiss/components/custom-cursor.tsx.
 * Copyright (c) 2025 Sufyaan (dev-sufyaan), MIT. See licenses/pitch-black-swiss-MIT.txt.
 * Safety adaptations: portal, stable listeners, capability updates, native-cursor fallbacks. */
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isMobile, setIsMobile] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const visibleRef = useRef(false);
  const mousePos = useRef({ x: 0, y: 0 });
  const cursorPos = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const preference = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    let dispose = () => {};

    function setup() {
      dispose();
      const hasHover =
        preference.matches && CSS.supports("mix-blend-mode", "difference");
      setIsMobile(!hasHover);
      if (!hasHover) return;

      // Original interpolation and RAF transform implementation.
      const lerp = (start: number, end: number, factor: number) =>
        start + (end - start) * factor;
      const animate = () => {
        cursorPos.current.x = lerp(
          cursorPos.current.x,
          mousePos.current.x,
          0.15,
        );
        cursorPos.current.y = lerp(
          cursorPos.current.y,
          mousePos.current.y,
          0.15,
        );
        if (cursorRef.current) {
          cursorRef.current.style.transform = `translate3d(${cursorPos.current.x}px, ${cursorPos.current.y}px, 0)`;
        }
        rafId.current = requestAnimationFrame(animate);
      };
      rafId.current = requestAnimationFrame(animate);

      const show = () => {
        if (!visibleRef.current) {
          visibleRef.current = true;
          setIsVisible(true);
        }
      };
      const hide = () => {
        visibleRef.current = false;
        setIsVisible(false);
        document.documentElement.classList.remove("custom-cursor-active");
      };
      const onMouseMove = (event: MouseEvent) => {
        mousePos.current.x = event.clientX;
        mousePos.current.y = event.clientY;
        show();
      };
      let hoverTimeout: ReturnType<typeof setTimeout>;
      const onMouseOver = (event: MouseEvent) => {
        clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
          const target = event.target as HTMLElement;
          const isInteractive =
            target.tagName === "A" ||
            target.tagName === "BUTTON" ||
            target.closest("a") !== null ||
            target.closest("button") !== null ||
            target.hasAttribute("data-cursor-hover");
          setIsHovering(isInteractive);
        }, 10);
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Tab") hide();
      };
      const onVisibilityChange = () => {
        if (document.hidden) hide();
      };
      window.addEventListener("mousemove", onMouseMove, { passive: true });
      window.addEventListener("mouseover", onMouseOver, { passive: true });
      document.addEventListener("mouseenter", show);
      document.addEventListener("mouseleave", hide);
      document.addEventListener("keydown", onKeyDown);
      document.addEventListener("visibilitychange", onVisibilityChange);
      window.addEventListener("blur", hide);
      dispose = () => {
        if (rafId.current !== null) cancelAnimationFrame(rafId.current);
        rafId.current = null;
        clearTimeout(hoverTimeout);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseover", onMouseOver);
        document.removeEventListener("mouseenter", show);
        document.removeEventListener("mouseleave", hide);
        document.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("blur", hide);
        hide();
        setIsHovering(false);
      };
    }

    setup();
    preference.addEventListener("change", setup);
    return () => {
      dispose();
      preference.removeEventListener("change", setup);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(
      "custom-cursor-active",
      !isMobile && isVisible && !!cursorRef.current,
    );
    return () => root.classList.remove("custom-cursor-active");
  }, [isMobile, isVisible]);

  if (isMobile) return null;
  return createPortal(
    <div
      ref={cursorRef}
      className="swiss-custom-cursor"
      aria-hidden="true"
      style={{ opacity: isVisible ? 1 : 0, willChange: "transform" }}
    >
      <div
        className="swiss-cursor-dot"
        style={{
          width: isHovering ? 48 : 12,
          height: isHovering ? 48 : 12,
          marginLeft: isHovering ? -24 : -6,
          marginTop: isHovering ? -24 : -6,
        }}
      />
    </div>,
    document.body,
  );
}
