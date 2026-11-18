"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import gsap from "gsap";

const IntroReady = createContext(true);
const words = ["Edit", "Create", "Design"];
const wordDuration = 0.9;
const exitStart = 2.72;

export function useIntroReady() {
  return useContext(IntroReady);
}

export function Intro({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const site = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const skipButton = useRef<HTMLButtonElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const skip = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    const root = document.documentElement;
    const layer = overlay.current;
    const content = site.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (
      root.dataset.intro !== "pending" ||
      motion.matches ||
      !layer ||
      !content
    ) {
      delete root.dataset.intro;
      const frame = requestAnimationFrame(() => setReady(true));
      return () => cancelAnimationFrame(frame);
    }

    root.dataset.intro = "playing";
    content.inert = true;

    let timeline: gsap.core.Timeline | undefined;
    const finish = () => {
      window.clearTimeout(fallback);
      if (!root.dataset.intro) return;
      const restoreFocus = layer.contains(document.activeElement);
      delete root.dataset.intro;
      content.inert = false;
      setReady(true);
      if (restoreFocus)
        document.getElementById("main")?.focus({ preventScroll: true });
    };
    skip.current = () => {
      timeline?.kill();
      finish();
    };
    const fallback = window.setTimeout(skip.current, 4200);
    const onMotionChange = () => {
      if (motion.matches) skip.current();
    };

    try {
      const progress = { value: 0 };
      const sequence = gsap.timeline({ onComplete: finish });
      timeline = sequence;
      const wordElements = layer.querySelectorAll(".intro-word");

      wordElements.forEach((word, index) => {
        const start = index * wordDuration;
        const end =
          index === wordElements.length - 1 ? exitStart : start + 0.55;
        sequence.fromTo(
          word,
          { y: 35, filter: "blur(10px)", opacity: 0 },
          {
            y: 0,
            filter: "blur(0px)",
            opacity: 1,
            duration: 0.55,
            ease: "power3.out",
          },
          start,
        );
        sequence.to(
          word,
          {
            y: -25,
            filter: "blur(8px)",
            opacity: 0,
            duration: 0.35,
            ease: "power2.in",
          },
          end,
        );
      });

      sequence.to(
        progress,
        {
          value: 1,
          duration: 2.65,
          ease: "none",
          onUpdate: () => {
            if (bar.current)
              bar.current.style.transform = `scaleX(${progress.value})`;
            const label = String(
              Math.max(1, Math.floor(progress.value * 100)),
            ).padStart(3, "0");
            if (counter.current && counter.current.textContent !== label) {
              counter.current.textContent = label;
            }
          },
        },
        0,
      );
      sequence.to(
        layer,
        {
          yPercent: -100,
          opacity: 0,
          duration: 0.76,
          ease: "power3.inOut",
          onStart: () => setReady(true),
        },
        exitStart,
      );
    } catch {
      skip.current();
      return;
    }

    motion.addEventListener("change", onMotionChange);
    layer.focus({ preventScroll: true });

    return () => {
      window.clearTimeout(fallback);
      motion.removeEventListener("change", onMotionChange);
      timeline?.revert();
      // React can replay layout effects during development.
      if (root.dataset.intro === "playing") root.dataset.intro = "pending";
      content.inert = false;
    };
  }, []);

  return (
    <IntroReady.Provider value={ready}>
      <div
        ref={site}
        className="site-content flex min-h-svh flex-col"
        data-entrance-ready={ready || undefined}
      >
        {children}
      </div>
      <div
        ref={overlay}
        className="site-intro"
        role="dialog"
        aria-modal="true"
        aria-label="Soumen Mandal portfolio intro"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") skip.current();
          if (event.key === "Tab") {
            event.preventDefault();
            skipButton.current?.focus();
          }
        }}
      >
        <span className="intro-brand" aria-hidden="true">
          Soumen Mandal
        </span>
        <button
          ref={skipButton}
          type="button"
          className="intro-skip"
          onClick={() => skip.current()}
        >
          Skip Intro
        </button>
        <div className="intro-word-mask" aria-hidden="true">
          {words.map((word) => (
            <span key={word} className="intro-word">
              {word}
            </span>
          ))}
        </div>
        <span ref={counter} className="intro-count" aria-hidden="true">
          001
        </span>
        <div className="intro-track" aria-hidden="true">
          <div ref={bar} className="intro-progress" />
        </div>
      </div>
    </IntroReady.Provider>
  );
}
