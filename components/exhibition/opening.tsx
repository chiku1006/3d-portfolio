import { useEffect, useRef, useState } from "react";

export function Opening({ ready }: { ready: boolean }) {
  const layer = useRef<HTMLDivElement>(null);
  const [minimumElapsed, setMinimumElapsed] = useState(false);
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

    const minimum = window.setTimeout(() => setMinimumElapsed(true), 440);
    window.addEventListener("pointerdown", dismiss, { once: true });
    window.addEventListener("keydown", dismiss, { once: true });
    return () => {
      window.clearTimeout(minimum);
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismiss);
    };
  }, [dismissed]);

  if (dismissed) return null;
  return (
    <div
      ref={layer}
      className="exhibit-opening"
      data-reveal={ready && minimumElapsed ? "" : undefined}
      aria-hidden="true"
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget || event.animationName === "opening-reveal") {
          setDismissed(true);
        }
      }}
    >
      <div className="opening-scene">
        <div className="opening-orbit">
          <span className="opening-sweep" />
          <span className="opening-monogram">sm<span>.</span></span>
        </div>
        <p>Loading exhibition</p>
      </div>
    </div>
  );
}
