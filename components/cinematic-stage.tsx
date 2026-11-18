"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const desktopQuery =
  "(min-width: 981px) and (min-height: 690px) and (pointer: fine) and (hover: hover)";
const motionQuery = "(prefers-reduced-motion: no-preference)";

const cardPoses = [
  { x: -0.16, y: -0.15, z: -305, rotationX: -13, rotationY: 24 },
  { x: 0.17, y: -0.1, z: -170, rotationX: 9, rotationY: -19 },
  { x: -0.19, y: 0.12, z: -140, rotationX: -11, rotationY: 17 },
  { x: 0.17, y: 0.16, z: -350, rotationX: 15, rotationY: -24 },
];

function centerWithin(element: HTMLElement, stage: HTMLElement) {
  let x = element.offsetWidth / 2;
  let y = element.offsetHeight / 2;
  let parent: HTMLElement | null = element;
  while (parent && parent !== stage) {
    x += parent.offsetLeft;
    y += parent.offsetTop;
    parent = parent.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

export function CinematicStage({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const hero = stage?.querySelector<HTMLElement>(".studio-hero");
    const copy = hero?.querySelector<HTMLElement>(".studio-hero-copy");
    const reel = hero?.querySelector<HTMLElement>(".studio-hero-visual");
    const meta = hero?.querySelector<HTMLElement>(".studio-hero-meta");
    const backdrop = hero?.querySelector<HTMLElement>(".swiss-hero-background");
    const featured = stage?.querySelector<HTMLElement>(".featured-work");
    const heading = featured?.querySelector<HTMLElement>(".featured-header");
    if (!stage || !hero || !copy || !reel || !meta || !featured || !heading)
      return;
    const cards = Array.from(
      featured.querySelectorAll<HTMLElement>(".motion-cell"),
    );

    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    let pin: ScrollTrigger | undefined;

    media.add({ desktop: desktopQuery, motion: motionQuery }, (context) => {
      if (!context.conditions?.motion) return;

      if (!context.conditions.desktop || !cards.length) {
        gsap.to(reel, {
          y: -18,
          scale: 0.97,
          ease: "none",
          scrollTrigger: {
            trigger: hero,
            start: "bottom 82%",
            end: "bottom 46%",
            scrub: true,
          },
        });
        gsap.fromTo(
          heading,
          { y: 16 },
          {
            y: 0,
            ease: "none",
            scrollTrigger: {
              trigger: featured,
              start: "top 94%",
              end: "top 62%",
              scrub: true,
            },
          },
        );
        return;
      }

      stage.dataset.cinematicDesktop = "";
      const centerX = () => stage.clientWidth / 2;
      const centerY = () => (stage.clientHeight + 52) / 2;
      const reelScale = () =>
        Math.min(
          (stage.clientWidth * 0.92) / reel.offsetWidth,
          (stage.clientHeight - 150) / reel.offsetHeight,
        );
      const reelX = () => centerX() - centerWithin(reel, stage).x;
      const reelY = () => centerY() - centerWithin(reel, stage).y;
      let suspended = false;

      const timeline = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        scrollTrigger: {
          trigger: stage,
          start: "top top",
          end: () =>
            "+=" + gsap.utils.clamp(790, 1220, stage.clientHeight * 1.2),
          pin: true,
          scrub: 0.22,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      });
      pin = timeline.scrollTrigger;

      timeline
        .to(
          copy,
          {
            x: () => -stage.clientWidth * 0.16,
            z: -390,
            rotationY: 19,
            autoAlpha: 0,
            duration: 0.38,
          },
          0.045,
        )
        .to(meta, { y: 22, autoAlpha: 0, duration: 0.2 }, 0.045)
        .to(
          reel,
          { x: reelX, y: reelY, scale: reelScale, duration: 0.41 },
          0.06,
        )
        .to(
          reel,
          { rotationY: -19, rotationX: 8, rotationZ: -2, duration: 0.23 },
          0.06,
        )
        .to(
          reel,
          { rotationY: 0, rotationX: 0, rotationZ: 0, duration: 0.21 },
          0.29,
        )
        .to(
          reel,
          {
            y: () => reelY() - stage.clientHeight * 0.22,
            scale: () => reelScale() * 0.83,
            rotationX: -13,
            autoAlpha: 0,
            duration: 0.28,
          },
          0.57,
        )
        .fromTo(
          heading,
          { y: 24, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 0.25,
          },
          0.69,
        );

      if (backdrop) timeline.to(backdrop, { opacity: 0, duration: 0.39 }, 0.19);

      cards.forEach((card, index) => {
        const pose = cardPoses[index % cardPoses.length];
        timeline.fromTo(
          card,
          {
            x: () =>
              (centerX() - centerWithin(card, stage).x) * 0.27 +
              pose.x * stage.clientWidth,
            y: () => pose.y * stage.clientHeight,
            z: pose.z,
            rotationX: pose.rotationX,
            rotationY: pose.rotationY,
            scale: 0.82,
            autoAlpha: 0,
          },
          {
            x: 0,
            y: 0,
            z: 0,
            rotationX: 0,
            rotationY: 0,
            scale: 1,
            autoAlpha: 1,
            duration: 0.46,
            ease: "power2.out",
          },
          0.43 + index * 0.035,
        );
      });

      const updatePresentation = () => {
        const progress = timeline.progress();
        const inFlight = progress > 0.045 && progress < 0.94;
        if (suspended !== inFlight) {
          suspended = inFlight;
          stage.toggleAttribute("data-cinematic-active", inFlight);
          if (inFlight)
            stage.dispatchEvent(new Event("cinematic-preview-reset"));
        }
        featured.inert = progress < 0.91;
        hero.inert = progress > 0.84;
      };
      timeline.eventCallback("onUpdate", updatePresentation);
      updatePresentation();

      return () => {
        pin = undefined;
        stage.removeAttribute("data-cinematic-desktop");
        stage.removeAttribute("data-cinematic-active");
        featured.inert = false;
        hero.inert = false;
      };
    });

    // Native fragments can resolve before ScrollTrigger inserts the pin spacer.
    const fragment = window.location.hash;
    const scrollToFragment = requestAnimationFrame(() => {
      if (!fragment || fragment !== window.location.hash || !pin) return;
      const target = document.getElementById(fragment.slice(1));
      if (target === featured) {
        window.scrollTo({ top: pin.end });
      } else {
        target?.scrollIntoView();
      }
    });

    return () => {
      cancelAnimationFrame(scrollToFragment);
      media.revert();
    };
  }, []);

  return (
    <div
      id="home"
      className="cinematic-experience one-page-section"
      tabIndex={-1}
    >
      <div className="cinematic-stage" data-cinematic-stage="" ref={stageRef}>
        {children}
      </div>
    </div>
  );
}
