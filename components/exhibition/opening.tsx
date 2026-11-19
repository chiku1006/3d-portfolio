import { useEffect, useRef, useState } from "react";

export function Opening() {
  const layer = useRef<HTMLDivElement>(null);
  const [dismissed, setDismissed] = useState(false);
  const [skipping, setSkipping] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    const dismiss = () => setDismissed(true);
    const hash = window.location.hash;
    if (
      (hash && hash !== "#home") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      (layer.current && getComputedStyle(layer.current).visibility === "hidden")
    ) {
      const frame = requestAnimationFrame(dismiss);
      return () => cancelAnimationFrame(frame);
    }

    const skip = () => setSkipping(true);
    window.addEventListener("pointerdown", skip, { once: true });
    window.addEventListener("keydown", skip, { once: true });
    window.addEventListener("wheel", skip, { once: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("wheel", skip);
    };
  }, [dismissed]);

  if (dismissed) return null;
  return (
    <div
      ref={layer}
      className="exhibit-opening"
      data-skipping={skipping || undefined}
      aria-hidden="true"
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) setDismissed(true);
      }}
    >
      <div
        className="opening-scene"
        onTransitionEnd={(event) => {
          if (event.target === event.currentTarget && skipping) setDismissed(true);
        }}
      >
        <span className="opening-wordmark">somo</span>
        <span className="opening-bar" />
      </div>
    </div>
  );
}
