import { useEffect, useRef, useState } from "react";

export function Opening() {
  const layer = useRef<HTMLDivElement>(null);
  const [dismissed, setDismissed] = useState(false);

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

    window.addEventListener("pointerdown", dismiss, { once: true });
    window.addEventListener("keydown", dismiss, { once: true });
    window.addEventListener("wheel", dismiss, { once: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("wheel", dismiss);
    };
  }, [dismissed]);

  if (dismissed) return null;
  return (
    <div
      ref={layer}
      className="exhibit-opening"
      aria-hidden="true"
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) setDismissed(true);
      }}
    >
      <div className="opening-scene">
        <div className="opening-horizon" />
        <div className="opening-orbit">
          <span className="opening-sweep" />
          <span className="opening-monogram">
            sm<span>.</span>
          </span>
        </div>
        <div className="opening-caption">
          <p>Loading exhibition</p>
          <span />
        </div>
      </div>
    </div>
  );
}
