"use client";

import dynamic from "next/dynamic";
import { ArrowDownRight, X } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useEffectEvent,
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
import { WorldBoundary } from "./world-boundary";
import {
  chapters,
  type ExhibitMedia,
  type MediaStop,
  type Stop,
  type TourMotion,
} from "./types";

const World = dynamic(() => import("./world-canvas"), { ssr: false });

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const fullViewportQuery = "(min-height: 500px)";
const finePointer = "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";
type WorldStatus = "starting" | "ready" | "recovering" | "failed";
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

const TrackStation = memo(function TrackStation({
  stop, active, selected, showreel, onOpen, onSelect, onInquiry,
}: {
  stop: Stop;
  active: boolean;
  selected: number;
  showreel?: ExhibitMedia;
  onOpen: (item: ExhibitMedia, origin?: HTMLElement) => void;
  onSelect: (stop: MediaStop, index: number) => void;
  onInquiry: (origin: HTMLElement) => void;
}) {
  return (
    <section
      id={stop.id}
      data-stop=""
      data-kind={stop.kind}
      data-active={active || undefined}
      aria-labelledby={stop.id + "-title"}
      tabIndex={-1}
      className="exhibit-stop"
    >
      <div className="station-body">
        {stop.kind === "arrival" && showreel && <Arrival item={showreel} onOpen={onOpen} />}
        {stop.kind === "media" && stop.items.length > 0 && (
          <MediaContent stop={stop} selected={selected} onOpen={onOpen} onSelect={(index) => onSelect(stop, index)} />
        )}
        {stop.kind === "bio" && <Bio />}
        {stop.kind === "tools" && <Tools />}
        {stop.kind === "contact" && <ContactContent onInquiry={onInquiry} />}
      </div>
    </section>
  );
});

export function Exhibition({ stops }: { stops: Stop[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<HTMLElement | null>(null);
  const invalidate = useRef<(() => void) | null>(null);
  const restoreStop = useRef<string | null>(null);
  const tour = useRef<TourMotion>({
    target: 0,
    progress: 0,
    active: 0,
    moving: false,
    snap: 0,
    pointerX: 0,
    pointerY: 0,
    modal: false,
  });
  const [active, setActive] = useState(0);
  const [selectedProjects, setSelectedProjects] = useState<Record<string, number>>(
    {},
  );
  const [display, setDisplay] = useState({
    reducedMotion: false,
    shortViewport: false,
    measured: false,
  });
  const [view, setView] = useState<"auto" | "2d" | "3d">("auto");
  const [worldStatus, setWorldStatus] = useState<WorldStatus>("starting");
  const [useLightweightRetry, setUseLightweightRetry] = useState(false);
  const [video, setVideo] = useState<ExhibitMedia | null>(null);
  const [inquiry, setInquiry] = useState(false);
  const hasRendered = useRef(false);
  const { reducedMotion, shortViewport, measured } = display;
  const auto3D = measured && !reducedMotion && !shortViewport;
  const showWorld =
    (view === "3d" || (view === "auto" && auto3D)) && worldStatus !== "failed";
  const worldVisible = showWorld && worldStatus === "ready";
  const spatial = worldVisible && !shortViewport;

  const selectStop = useCallback((index: number) => {
    if (tour.current.active === index) return;
    tour.current.active = index;
    setActive(index);
  }, []);
  const onCameraFrame = useCallback((progress: number, moving: boolean) => {
    tour.current.progress = progress;
    tour.current.moving = moving;
  }, []);

  const rememberStop = useCallback(() => {
    restoreStop.current = stops[tour.current.active]?.id ?? null;
  }, [stops]);
  const onReady = useCallback(() => {
    if (!shortViewport && !restoreStop.current && (hasRendered.current || tour.current.active > 0)) {
      rememberStop();
    }
    hasRendered.current = true;
    setWorldStatus("ready");
  }, [rememberStop, shortViewport]);
  const onContextLost = useCallback(() => {
    if (!shortViewport && hasRendered.current) rememberStop();
    setWorldStatus("recovering");
  }, [rememberStop, shortViewport]);
  const onFailure = useCallback((error: Error) => {
    if (!shortViewport && hasRendered.current) rememberStop();
    console.warn("[Portfolio 3D] Using the 2D view.", error);
    setWorldStatus("failed");
  }, [rememberStop, shortViewport]);

  const updateDisplay = useEffectEvent((reducedMotion: boolean, shortViewport: boolean) => {
    if (hasRendered.current) rememberStop();
    if (view === "auto" && (reducedMotion || shortViewport)) {
      setWorldStatus((current) => current === "failed" ? current : "starting");
    }
    setDisplay({ reducedMotion, shortViewport, measured: true });
  });

  useEffect(() => {
    const motion = window.matchMedia(reducedMotionQuery);
    const height = window.matchMedia(fullViewportQuery);
    const update = () => updateDisplay(motion.matches, !height.matches);
    const frame = requestAnimationFrame(update);
    motion.addEventListener("change", update);
    height.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener("change", update);
      height.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (!showWorld || worldStatus === "ready") return;
    const recovering = worldStatus === "recovering";
    const errorMessage = recovering
      ? "The WebGL 2 context did not recover."
      : "The 3D scene did not render its first frame.";
    let timer: number;
    const waitWhileVisible = () => {
      window.clearTimeout(timer);
      if (document.hidden) return;
      timer = window.setTimeout(
        () => onFailure(new Error(errorMessage)),
        recovering ? 6_000 : 15_000,
      );
    };
    waitWhileVisible();
    document.addEventListener("visibilitychange", waitWhileVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", waitWhileVisible);
    };
  }, [onFailure, showWorld, worldStatus]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const height = window.matchMedia(fullViewportQuery);
    const motion = window.matchMedia(reducedMotionQuery);
    gsap.registerPlugin(ScrollTrigger);
    const nodes = Array.from(
      track.querySelectorAll<HTMLElement>("[data-stop]"),
    );
    let centers: number[] = [];
    function readPositions() {
      centers = nodes.map(
        (node) => node.getBoundingClientRect().top + window.scrollY,
      );
    }
    function update(y: number, snap = false) {
      // A rotating device can resize the old layout before React switches modes.
      const isShort = !height.matches;
      if (isShort !== shortViewport || motion.matches !== reducedMotion) return;
      let index = centers.findLastIndex((stop) => stop <= y + 1);
      index = Math.max(0, index);
      const next = centers[index + 1];
      const local =
        next === undefined ? 0 : (y - centers[index]) / (next - centers[index]);
      const target = index + Math.max(0, Math.min(1, local));
      if (!spatial || snap || reducedMotion) {
        const selected = spatial
          ? index + Number(local >= 0.515)
          : Math.max(0, centers.findLastIndex(
              (stop) => stop <= y + Math.min(160, window.innerHeight * 0.28),
            ));
        selectStop(selected);
      }
      if (!snap && tour.current.target === target) return;
      tour.current.target = target;
      if (snap) tour.current.snap++;
      invalidate.current?.();
    }

    readPositions();
    const trigger = ScrollTrigger.create({
      trigger: track,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => update(self.scroll()),
      onRefresh: (self) => {
        readPositions();
        update(self.scroll());
      },
    });

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
        fragment;
      restoreStop.current = null;
      if (id)
        document.getElementById(id)?.scrollIntoView({ behavior: "instant" });
      ScrollTrigger.refresh();
      trigger.update();
      update(window.scrollY, true);
    });
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      cancelAnimationFrame(frame);
      trigger.kill();
    };
  }, [shortViewport, reducedMotion, spatial, stops, selectStop]);

  useEffect(() => {
    const fine = window.matchMedia(finePointer);
    const point = (event: PointerEvent) => {
      if (!fine.matches || event.pointerType !== "mouse" || tour.current.modal)
        return;
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = 1 - (event.clientY / window.innerHeight) * 2;
      if (tour.current.pointerX === x && tour.current.pointerY === y) return;
      tour.current.pointerX = x;
      tour.current.pointerY = y;
      invalidate.current?.();
    };
    const reset = () => {
      if (!tour.current.pointerX && !tour.current.pointerY) return;
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

  const openInquiry = useCallback((origin: HTMLElement) => {
    tour.current.modal = true;
    originRef.current = origin;
    setInquiry(true);
    invalidate.current?.();
  }, []);

  const selectProject = useCallback((stop: MediaStop, index: number) => {
    setSelectedProjects((previous) => ({ ...previous, [stop.id]: index }));
    window.history.replaceState(window.history.state, "", "#" + stop.items[index].id);
  }, []);

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
    <div
      className="exhibition"
      data-world={worldVisible || undefined}
      data-spatial={spatial || undefined}
    >
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
        <button
          type="button"
          className="exhibit-mode"
          disabled={!measured}
          title={worldStatus === "failed" ? "Retry the 3D view with lighter graphics" : undefined}
          onClick={() => {
            if (!shortViewport) rememberStop();
            if (worldStatus === "failed") setUseLightweightRetry(true);
            setWorldStatus("starting");
            setView(showWorld ? "2d" : "3d");
          }}
        >
          {worldVisible ? "2D view" : showWorld ? "Cancel 3D" : "3D view"}
        </button>
        <p className="exhibit-mode-status" role="status">
          {view === "3d" && worldStatus === "failed" && "3D couldn’t start. You can keep browsing in 2D."}
        </p>
      </header>

      {showWorld && (
        <WorldBoundary onError={onFailure}>
          <World
            stops={stops}
            selectedProjects={selectedProjects}
            motion={tour}
            frameRequestRef={invalidate}
            onReady={onReady}
            onContextLost={onContextLost}
            onFailure={onFailure}
            onOpen={openVideo}
            onCameraFrame={onCameraFrame}
            onActive={spatial ? selectStop : undefined}
            active={active}
            modalOpen={Boolean(video || inquiry)}
            backdrop={shortViewport}
            reducedMotion={reducedMotion}
            forceLightweight={useLightweightRetry}
          />
        </WorldBoundary>
      )}

      <div className="exhibit-track" ref={trackRef} onFocus={focusStation}>
        {stops.map((stop, i) => (
          <TrackStation
            key={stop.id}
            stop={stop}
            active={i === active}
            selected={selectedProjects[stop.id] ?? 0}
            showreel={showreel}
            onOpen={openVideo}
            onSelect={selectProject}
            onInquiry={openInquiry}
          />
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
