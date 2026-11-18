"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useIntroReady } from "./intro";

export function PageMotion({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const ready = useIntroReady();

  useLayoutEffect(() => {
    const scope = container.current;
    if (!ready || !scope) return;

    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", (context) => {
      const entering = scope.querySelectorAll("[data-page-enter]");
      if (entering.length) {
        gsap.fromTo(
          entering,
          { opacity: 0, y: 16, filter: "blur(7px)" },
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 0.48,
            ease: "power3.out",
            stagger: 0.055,
            clearProps: "opacity,transform,filter",
          },
        );
      }

      const sections = scope.querySelectorAll("[data-scroll-reveal]");
      if (!sections.length || !("IntersectionObserver" in window)) return;
      gsap.set(sections, { opacity: 0, y: 16, filter: "blur(5px)" });
      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .map((entry) => entry.target);
          if (!visible.length) return;
          visible.forEach((element) => observer.unobserve(element));
          context.add(() => {
            gsap.to(visible, {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 0.55,
              stagger: 0.065,
              ease: "power3.out",
              clearProps: "opacity,transform,filter",
            });
          });
        },
        { threshold: 0.1 },
      );

      sections.forEach((section) => observer.observe(section));
      return () => observer.disconnect();
    });

    return () => media.revert();
  }, [ready]);

  return (
    <div ref={container} className={className}>
      {children}
    </div>
  );
}
