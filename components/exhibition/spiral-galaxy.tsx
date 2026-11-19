"use client";

import { useEffect, useRef } from "react";

const cols = 136;
const rows = 88;
const cell = 7;
const worldStep = 86 / cols;
const tau = 2 * Math.PI;
const pitch = 0.36;
const tilt = 0.32;
const squash = 0.52;
const cr = Math.cos(tilt);
const sr = Math.sin(tilt);
const clamp = (n: number) => Math.max(0, Math.min(1, n));

function gradient(colors: string[], steps: number) {
  const stops = colors.map((hex) => parseInt(hex.slice(1), 16));
  return Array.from({ length: steps }, (_, i) => {
    const position = i * (stops.length - 1) / (steps - 1);
    const index = Math.min(stops.length - 2, Math.floor(position));
    const mix = position - index;
    const rgb = [16, 8, 0].map((shift) => {
      const a = (stops[index] >> shift) & 255;
      const b = (stops[index + 1] >> shift) & 255;
      return Math.round(a + (b - a) * mix);
    });
    return "rgb(" + rgb.join(",") + ")";
  });
}

const core = gradient(["#3a2410", "#8a5a24", "#d8a050", "#f6d898", "#fff4dc", "#ffffff"], 10);
const arms = gradient(["#0a1030", "#1c2c6a", "#3456a8", "#6488d8", "#a8c0f4", "#e8f0ff"], 12);
const pink = ["#8a2a6a", "#d4509a", "#ff9ccc"];

function hash(x: number, y: number) {
  const bits = Math.imul(x, 374761393) + Math.imul(y, 668265263) | 0;
  return (Math.imul(bits ^ (bits >>> 13), 1274126177) >>> 0) / 4294967296;
}

function fbm(x: number, y: number) {
  let result = 0;
  let weight = 4 / 7;
  for (let octave = 0; octave < 3; octave++) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const top = hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u;
    const bottom = hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u;
    result += (top * (1 - v) + bottom * v) * weight;
    x *= 2;
    y *= 2;
    weight /= 2;
  }
  return result;
}

function prepareGalaxy(ctx: CanvasRenderingContext2D) {
  const cells = Array.from({ length: cols * rows }, (_, index) => {
    const col = index % cols, row = Math.floor(index / cols);
    const x = col + (row % 2 ? 0.75 : 0.25);
    const y = row + 0.5;
    const dx = (x - cols / 2) * worldStep;
    const dy = (y - rows / 2) * worldStep;
    const u = dx * cr + dy * sr, w = (-dx * sr + dy * cr) / squash;
    const radius = Math.hypot(u, w) + 0.001;
    return {
      x, y, u, w, radius,
      phase: Math.atan2(w, u) - Math.log(radius) / pitch,
      bulge: Math.exp(-radius / 6) * 1.4,
      falloff: Math.exp(-radius / 24),
    };
  });

  let seed = 17;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const stars = Array.from({ length: 120 }, () => ({
    x: Math.floor(random() * cols), y: Math.floor(random() * rows),
    phase: random() * tau, brightness: random(),
  }));
  const diskStars = Array.from({ length: 160 }, () => {
    const radius = 4 + random() * 40;
    const arm = random() < 0.5 ? 0 : Math.PI;
    return {
      radius, angle: arm + Math.log(radius) / pitch + (random() - 0.5) * 0.7,
      phase: random() * tau,
    };
  });

  const dot = (x: number, y: number, radius: number, color: string, opacity: number) => {
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x * cell, y * cell, radius, 0, tau);
    ctx.fill();
  };
  const glint = (x: number, y: number, size: number, opacity: number) => {
    const px = x * cell, py = y * cell;
    ctx.globalAlpha = opacity;
    ctx.fillStyle = "#f1f6ff";
    ctx.fillRect(px - size, py - 0.55, size * 2, 1.1);
    ctx.fillRect(px - 0.55, py - size, 1.1, size * 2);
  };
  const darkCells = new Uint8Array(cells.length);

  return (time: number) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const spin = time * 0.12;
    const cs = Math.cos(spin), ss = Math.sin(spin);
    for (let index = 0; index < cells.length; index++) {
      const { x, y, u, w, radius, phase, bulge, falloff } = cells[index];
      darkCells[index] = 1;
      if (radius > 83) continue;
      const armPhase = 2 * (phase - spin);
      const arm = (0.5 + 0.5 * Math.cos(armPhase)) ** 2.2;
      const lane = (0.5 + 0.5 * Math.cos(armPhase + 0.9)) ** 6;
      const clump = fbm((u * cs + w * ss) * 0.18 + 40, (-u * ss + w * cs) * 0.18);
      const disk = falloff * (0.22 + 1.25 * arm * (0.45 + clump)) * (1 - 0.55 * lane * clamp(radius / 8));
      const intensity = clamp(bulge + disk);
      darkCells[index] = intensity < 0.09 ? 1 : 0;
      if (intensity < 0.036) continue;

      const warm = clamp(bulge / (bulge + disk + 0.001) * 1.4 - 0.2);
      let color = arms[Math.min(11, Math.floor(1 + intensity * 14 + warm * 3))];
      if (warm > 0.5) color = core[Math.min(9, Math.floor(intensity * 10))];
      else if (arm > 0.6 && clump > 0.62 && radius > 9) {
        color = pink[Math.min(2, Math.floor((clump - 0.62) * 14))];
      }
      const size = cell * (0.055 + 0.39 * intensity ** 0.78);
      dot(x, y, size, color, clamp((intensity - 0.036) / 0.19));
    }

    for (const { x, y, phase, brightness } of stars) {
      if (!darkCells[y * cols + x]) continue;
      const twinkle = 0.5 + 0.5 * Math.sin(time * (1 + 2 * brightness) + phase);
      const position = cells[y * cols + x];
      const opacity = 0.36 + twinkle * 0.54;
      if (brightness > 0.86 && twinkle > 0.5) {
        glint(position.x, position.y, 2.8, opacity);
      } else {
        dot(position.x, position.y, 0.55 + brightness * 0.64, brightness > 0.5 ? "#ffffff" : "#8fa0e0", opacity);
      }
    }
    for (const { radius, angle, phase } of diskStars) {
      const u = Math.cos(angle + spin) * radius;
      const w = Math.sin(angle + spin) * radius * squash;
      const x = cols / 2 + (u * cr - w * sr) / worldStep;
      const y = rows / 2 + (u * sr + w * cr) / worldStep;
      const twinkle = Math.sin(time * 2 + phase);
      if (twinkle > 0.65) glint(x, y, 2.2 + twinkle, 0.8);
      else if (twinkle > -0.3) dot(x, y, 0.95, "#d9e9ff", 0.64);
    }
  };
}

export function SpiralGalaxy() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx) return;

    const draw = prepareGalaxy(ctx);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: number | undefined;
    let visible = false;
    let time = 0;
    const update = () => {
      window.clearInterval(timer);
      if (!visible || document.hidden) return;
      draw(time);
      if (!reducedMotion.matches) {
        timer = window.setInterval(() => {
          time += 1 / 24;
          draw(time);
        }, 1000 / 24);
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(element);
    reducedMotion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
      window.clearInterval(timer);
    };
  }, []);

  return <canvas ref={canvas} className="tools-ascii" width={cols * cell} height={rows * cell} aria-hidden="true" />;
}
