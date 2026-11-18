"use client";
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import Link from "next/link";
import { HeroBackground } from "./hero-background";
import { useIntroReady } from "./intro";

export function Hero() {
  const hero = useRef<HTMLElement>(null);
  const introReady = useIntroReady();
  useLayoutEffect(() => {
    if (!introReady) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const afterIntro = document.documentElement.hasAttribute("data-intro");
      const context = gsap.context(() => {
        gsap.fromTo(
          "[data-reveal]",
          { opacity: 0, y: afterIntro ? 32 : 25, filter: "blur(9px)" },
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            duration: afterIntro ? 0.7 : 0.42,
            stagger: afterIntro ? 0.105 : 0.028,
            delay: afterIntro ? 0.17 : 0,
            ease: "power3.out",
            clearProps: "opacity,transform,filter",
          },
        );
      }, hero);
      return () => context.revert();
    });
    return () => media.revert();
  }, [introReady]);
  return (
    <section
      id="home"
      ref={hero}
      className="hero relative flex items-center justify-center"
      aria-labelledby="hero-title"
    >
      <HeroBackground />
      <div className="hero-content flex flex-col items-center text-center">
        <p className="availability" data-reveal>
          <span aria-hidden="true" />
          Available for projects
        </p>
        <p className="hero-eyebrow" data-reveal>
          VIDEO EDITOR &amp; MOTION DESIGNER
        </p>
        <h1 id="hero-title" className="hero-name" data-reveal>
          Soumen Mandal
        </h1>
        <p className="hero-role" data-reveal>
          A <em>Video Editor &amp; Motion Designer</em> based in Kolkata, India.
        </p>
        <p className="hero-description" data-reveal>
          Crafting compelling visuals, seamless edits, and motion experiences
          that bring ideas to life.
        </p>
        <div
          className="hero-actions flex items-center justify-center gap-4"
          data-reveal
        >
          <Link href="#featured-projects" className="hero-button button-primary">
            Catalogue
          </Link>
          <Link href="/hire" className="hero-button button-outline">
            Connect <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
      <Link
        href="#featured-projects"
        className="scroll-indicator"
        aria-label="Scroll to featured work"
        data-reveal
      >
        <span>SCROLL</span>
        <span className="scroll-track" aria-hidden="true" />
      </Link>
    </section>
  );
}
