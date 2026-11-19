"use client";

import dynamic from "next/dynamic";
import { ArrowDownRight, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionDialog } from "@/src/components/MotionGallery";
import { HireForm } from "@/components/hire-form";
import { contact } from "@/src/data/site";
import { Arrival, Bio, ContactContent, MediaContent, Tools } from "./content";
import { Opening } from "./opening";
import {
  chapters,
  type ExhibitMedia,
  type Stop,
  type TourMotion,
} from "./types";

const World = dynamic(() => import("./world-canvas"), { ssr: false });

const spatialPreference =
  "(prefers-reduced-motion: no-preference) and (min-height: 500px)";
const finePointer = "(hover: hover) and (pointer: fine)";
const links = [
  { label: "Home", id: "home", chapter: 0 },
  { label: "My Work", id: "work", chapter: 2 },
  { label: "Info", id: "info", chapter: 4 },
  { label: "Hire Me", id: "hire", chapter: 5 },
] as const;

function InquiryDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog
      className="motion-dialog inquiry-dialog"
      ref={dialog}
      aria-labelledby="inquiry-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className="motion-dialog-panel inquiry-panel">
        <header className="motion-dialog-header">
          <h2 id="inquiry-title">Tell me about your project.</h2>
          <button
            type="button"
            className="work-controlButton"
            aria-label="Close inquiry"
            onClick={() => dialog.current?.close()}
            autoFocus
          >
            <X size={21} />
          </button>
        </header>
        <HireForm />
      </div>
    </dialog>
  );
}

export function Exhibition({ stops }: { stops: Stop[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<HTMLElement | null>(null);
  const invalidate = useRef<(() => void) | null>(null);
  const restoreStop = useRef<string | null>(null);
  const tour = useRef<TourMotion>({
    progress: 0,
    active: 0,
    pointerX: 0,
    pointerY: 0,
    modal: false,
  });
  const [active, setActive] = useState(0);
  const [selectedProjects, setSelectedProjects] = useState<Record<string, number>>(
    {},
  );
  const [permitted, setPermitted] = useState(false);
  const [ready, setReady] = useState(false);
  const [flat, setFlat] = useState(false);
  const [failed, setFailed] = useState(false);
  const [video, setVideo] = useState<ExhibitMedia | null>(null);
  const [inquiry, setInquiry] = useState(false);
  const showWorld = permitted && !flat && !failed;
  const spatial = showWorld && ready;

  const onReady = useCallback(() => setReady(true), []);
  const onFailure = useCallback(() => {
    restoreStop.current = stops[tour.current.active]?.id ?? null;
    setFailed(true);
  }, [stops]);

  useEffect(() => {
    const preference = window.matchMedia(spatialPreference);
    const update = () => setPermitted(preference.matches);
    const frame = requestAnimationFrame(update);
    preference.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame);
      preference.removeEventListener("change", update);
    };
  }, []);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    gsap.registerPlugin(ScrollTrigger);
    const nodes = Array.from(
      track.querySelectorAll<HTMLElement>("[data-stop]"),
    );
    const cursor = { position: 0 };
    let centers: number[] = [];
    const ease = gsap.parseEase("power2.inOut");
    function readPositions() {
      centers = nodes.map(
        (node) => node.getBoundingClientRect().top + window.scrollY,
      );
    }
    function update(y: number) {
      let index = centers.findLastIndex((stop) => stop <= y + 1);
      index = Math.max(0, index);
      const next = centers[index + 1];
      const local =
        next === undefined ? 0 : (y - centers[index]) / (next - centers[index]);
      const travel = ease(gsap.utils.clamp(0, 1, (local - 0.17) / 0.69));
      const selected = spatial
        ? index + Number(travel >= 0.5)
        : Math.max(
            0,
            centers.findLastIndex(
              (stop) => stop <= y + Math.min(160, window.innerHeight * 0.28),
            ),
          );
      tour.current.progress = index + travel;
      if (tour.current.active !== selected) {
        tour.current.active = selected;
        setActive(selected);
      }
      invalidate.current?.();
    }

    readPositions();
    const tween = gsap.fromTo(
      cursor,
      { position: 0 },
      {
        position: 1,
        duration: 1,
        ease: "none",
      },
    );
    const trigger = ScrollTrigger.create({
      trigger: track,
      start: "top top",
      end: "bottom bottom",
      animation: tween,
      scrub: spatial ? 0.23 : true,
      onRefresh: readPositions,
    });
    tween.eventCallback("onUpdate", () =>
      update(trigger.start + cursor.position * (trigger.end - trigger.start)),
    );

    function resolveProjectLink(fragment: string) {
      if (!fragment || stops.some((stop) => stop.id === fragment)) return;
      for (const stop of stops) {
        if (stop.kind !== "media") continue;
        const index = stop.items.findIndex((item) => item.id === fragment);
        if (index < 0) continue;
        setSelectedProjects((current) =>
          current[stop.id] === index
            ? current
            : { ...current, [stop.id]: index },
        );
        return stop.id;
      }
    }
    function onHashChange() {
      const id = resolveProjectLink(window.location.hash.slice(1));
      if (id)
        document.getElementById(id)?.scrollIntoView({ behavior: "instant" });
    }
    window.addEventListener("hashchange", onHashChange);
    const frame = requestAnimationFrame(() => {
      const fragment = window.location.hash.slice(1);
      const id =
        restoreStop.current ??
        resolveProjectLink(fragment) ??
        (spatial ? fragment : null);
      restoreStop.current = null;
      if (id)
        document.getElementById(id)?.scrollIntoView({ behavior: "instant" });
      ScrollTrigger.refresh();
      update(window.scrollY);
    });
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      cancelAnimationFrame(frame);
      trigger.kill();
      tween.kill();
    };
  }, [spatial, stops]);

  useEffect(() => {
    const fine = window.matchMedia(finePointer);
    const point = (event: PointerEvent) => {
      if (!fine.matches || event.pointerType !== "mouse" || tour.current.modal)
        return;
      tour.current.pointerX = (event.clientX / window.innerWidth) * 2 - 1;
      tour.current.pointerY = 1 - (event.clientY / window.innerHeight) * 2;
      invalidate.current?.();
    };
    const reset = () => {
      tour.current.pointerX = tour.current.pointerY = 0;
      invalidate.current?.();
    };
    window.addEventListener("pointermove", point, { passive: true });
    document.documentElement.addEventListener("pointerleave", reset);
    window.addEventListener("blur", reset);
    fine.addEventListener("change", reset);
    return () => {
      window.removeEventListener("pointermove", point);
      document.documentElement.removeEventListener("pointerleave", reset);
      window.removeEventListener("blur", reset);
      fine.removeEventListener("change", reset);
    };
  }, []);

  const openVideo = useCallback((item: ExhibitMedia, origin?: HTMLElement) => {
    if (!item.videoAvailable || tour.current.modal) return;
    tour.current.modal = true;
    originRef.current =
      origin ??
      trackRef.current?.querySelector<HTMLElement>(
        '[data-active] a[aria-haspopup="dialog"]',
      ) ??
      null;
    setVideo(item);
    invalidate.current?.();
  }, []);

  function openInquiry(origin: HTMLElement) {
    tour.current.modal = true;
    originRef.current = origin;
    setInquiry(true);
    invalidate.current?.();
  }

  function closeDialog() {
    tour.current.modal = false;
    setVideo(null);
    setInquiry(false);
    originRef.current?.focus({ preventScroll: true });
    originRef.current = null;
    invalidate.current?.();
  }

  function focusStation(event: FocusEvent<HTMLDivElement>) {
    if (
      !spatial ||
      !(event.target instanceof HTMLElement) ||
      tour.current.modal
    )
      return;
    const station = event.target.closest<HTMLElement>("[data-stop]");
    if (
      station &&
      event.target !== station &&
      !station.hasAttribute("data-active")
    ) {
      station.scrollIntoView({ behavior: "instant" });
    }
  }

  const current = stops[active] ?? stops[0];
  const reelStop = stops.find((stop) => stop.chapter === 1);
  const showreel = reelStop?.kind === "media" ? reelStop.items[0] : undefined;
  return (
    <div className="exhibition" data-spatial={spatial || undefined}>
      <Opening />
      <header className="exhibit-header">
        <a
          className="exhibit-logo"
          href="#home"
          aria-label="Soumen Mandal, arrival"
        >
          <span>
            sm<span className="logo-period">.</span>
          </span>
          <span className="logo-wordmark">
            Soumen
            <br />
            Mandal
          </span>
        </a>
        <nav className="exhibit-nav" aria-label="Main navigation">
          {links.map((link) => (
            <a
              key={link.id}
              href={"#" + link.id}
              aria-label={link.label}
              aria-current={
                current.chapter === link.chapter ||
                (link.chapter === 0 && current.chapter === 1) ||
                (link.chapter === 2 && current.chapter === 3)
                  ? "location"
                  : undefined
              }
            >
              {link.label}
              {link.chapter === 5 && <ArrowDownRight size={14} />}
            </a>
          ))}
        </nav>
        {permitted && !failed && (
          <button
            type="button"
            className="exhibit-mode"
            onClick={() => {
              restoreStop.current = current.id;
              setReady(false);
              setFlat(!flat);
            }}
          >
            {flat ? "3D view" : "2D view"}
          </button>
        )}
      </header>

      {showWorld && (
        <World
          stops={stops}
          selectedProjects={selectedProjects}
          motion={tour}
          frameRequestRef={invalidate}
          onReady={onReady}
          onFailure={onFailure}
          onOpen={openVideo}
          active={active}
          modalOpen={Boolean(video || inquiry)}
        />
      )}

      <div className="exhibit-track" ref={trackRef} onFocus={focusStation}>
        {stops.map((stop, i) => (
          <section
            key={stop.id}
            id={stop.id}
            data-stop=""
            data-kind={stop.kind}
            data-active={i === active || undefined}
            aria-labelledby={stop.id + "-title"}
            tabIndex={-1}
            className="exhibit-stop"
          >
            <div className="station-body">
              {stop.kind === "arrival" && showreel && (
                <Arrival item={showreel} onOpen={openVideo} />
              )}
              {stop.kind === "media" && stop.items.length > 0 && (
                <MediaContent
                  stop={stop}
                  selected={selectedProjects[stop.id] ?? 0}
                  onOpen={openVideo}
                  onSelect={(index) => {
                    setSelectedProjects((previous) => ({
                      ...previous,
                      [stop.id]: index,
                    }));
                    window.history.replaceState(
                      window.history.state,
                      "",
                      "#" + stop.items[index].id,
                    );
                  }}
                />
              )}
              {stop.kind === "bio" && <Bio />}
              {stop.kind === "tools" && <Tools />}
              {stop.kind === "contact" && (
                <ContactContent onInquiry={openInquiry} />
              )}
            </div>
          </section>
        ))}
      </div>

      <aside className="exhibit-hud" aria-label="Exhibition chapters">
        <p className="hud-current">
          <span>{String(current.chapter + 1).padStart(2, "0")} / 06</span>
          {chapters[current.chapter].label}
        </p>
        <nav className="hud-chapters" aria-label="Jump to chapter">
          {chapters.map(({ id, label }, chapter) => (
            <a
              key={id}
              aria-label={label}
              href={"#" + id}
              aria-current={
                current.chapter === chapter ? "location" : undefined
              }
            >
              <span />
            </a>
          ))}
        </nav>
        <p className="hud-location">{contact.location}</p>
      </aside>

      {video && <MotionDialog item={video} onClose={closeDialog} />}
      {inquiry && <InquiryDialog onClose={closeDialog} />}
    </div>
  );
}
