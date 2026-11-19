import { useEffect, useRef, useState } from "react";

function starShadows(count: number, seed: number) {
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  return Array.from({ length: count }, (_, index) => {
    const x = (random() * 118).toFixed(2);
    const y = (random() * 118).toFixed(2);
    const opacity = (0.15 + random() * 0.44).toFixed(2);
    const tint = index % 5 === 0 ? "191 170 240" : "191 215 247";
    return `${x}vw ${y}vh 0 rgb(${tint} / ${opacity})`;
  }).join(", ");
}

const distantStars = starShadows(106, 54);
const nearStars = starShadows(23, 178);

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
        <span className="opening-stars" style={{ boxShadow: distantStars }} />
        <span className="opening-stars opening-stars-near" style={{ boxShadow: nearStars }} />
        <div className="opening-eclipse">
          <span className="opening-corona" />
          <span className="opening-planet" />
          <span className="opening-flare" />
        </div>
        <div className="opening-title">
          <span>Soumen</span>
          <em>Mandal<span>.</span></em>
        </div>
        <div className="opening-caption">
          <p>Loading exhibition</p>
          <span />
        </div>
      </div>
    </div>
  );
}
