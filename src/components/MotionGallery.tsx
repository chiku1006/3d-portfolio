"use client";

import Image from "next/image";
import { Play, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import type { GalleryMedia } from "@/src/data/projects";
import { VideoPlayer } from "./VideoPlayer";
import { formatTime, setGalleryPlaying } from "./work-media";
import "./motion-gallery.css";

const hoverQuery =
  "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

export type GalleryItem = GalleryMedia & {
  videoAvailable: boolean;
  posterAvailable: boolean;
  duration?: number;
};

function MotionDialog({
  item,
  onClose,
}: {
  item: GalleryItem;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => {
      if (element?.open) element.close();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="motion-dialog"
      aria-labelledby={titleId}
      onClose={(event) => {
        if (!event.currentTarget.open) {
          event.currentTarget.querySelector("video")?.pause();
          onClose();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className="motion-dialog-panel" ref={panel}>
        <header className="motion-dialog-header">
          <h2 id={titleId}>{item.title}</h2>
          <button
            type="button"
            className="work-controlButton"
            aria-label="Close video"
            onClick={() => dialog.current?.close()}
            autoFocus
          >
            <X size={21} aria-hidden="true" />
          </button>
        </header>
        <VideoPlayer
          title={item.title}
          videoSrc={item.videoSrc}
          videoAvailable={item.videoAvailable}
          fullscreenTarget={panel}
        />
      </div>
    </dialog>
  );
}

export function MotionGallery({
  showreel,
  projects,
}: {
  showreel?: GalleryItem;
  projects: readonly GalleryItem[];
}) {
  const [selected, setSelected] = useState<GalleryItem | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const modalOpen = useRef(false);
  const preview = useRef<HTMLVideoElement | null>(null);
  const previewTimer = useRef<number | undefined>(undefined);

  const stopPreview = useCallback(() => {
    window.clearTimeout(previewTimer.current);
    previewTimer.current = undefined;
    const clip = preview.current;
    preview.current = null;
    if (clip) {
      clip.removeAttribute("data-playing");
      clip.pause();
      if (clip.readyState > 0) clip.currentTime = 0;
      if (clip.hasAttribute("src")) {
        clip.removeAttribute("src");
        clip.load();
      }
    }
    if (!modalOpen.current) setGalleryPlaying(false);
  }, []);

  useEffect(() => {
    const preference = window.matchMedia(hoverQuery);
    const onPreferenceChange = () => {
      if (!preference.matches) stopPreview();
    };
    const onVisibilityChange = () => {
      if (document.hidden) stopPreview();
    };
    preference.addEventListener("change", onPreferenceChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      preference.removeEventListener("change", onPreferenceChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      modalOpen.current = false;
      stopPreview();
    };
  }, [stopPreview]);

  function startPreview(event: PointerEvent<HTMLButtonElement>, src: string) {
    if (
      modalOpen.current ||
      event.pointerType !== "mouse" ||
      !window.matchMedia(hoverQuery).matches
    )
      return;
    const clip = event.currentTarget.querySelector("video");
    if (!clip || preview.current === clip) return;
    stopPreview();
    preview.current = clip;
    const timer = window.setTimeout(() => {
      if (document.hidden || preview.current !== clip) return;
      setGalleryPlaying(true);
      clip.muted = true;
      clip.src = src;
      void clip.play().catch(() => {
        if (previewTimer.current === timer) stopPreview();
      });
    }, 140);
    previewTimer.current = timer;
  }

  function card(item: GalleryItem, featured = false) {
    return (
      <article
        id={showreel ? item.id : `featured-${item.id}`}
        className={
          featured ? "motion-tile motion-tile-featured" : "motion-tile"
        }
        data-scroll-reveal
      >
        <button
          type="button"
          className="motion-card"
          data-no-poster={!item.posterAvailable || undefined}
          aria-label={
            item.videoAvailable
              ? `Play ${item.title}`
              : `${item.title} — video unavailable`
          }
          aria-haspopup={item.videoAvailable ? "dialog" : undefined}
          disabled={!item.videoAvailable}
          onPointerEnter={(event) => startPreview(event, item.videoSrc)}
          onPointerLeave={stopPreview}
          onPointerCancel={stopPreview}
          onClick={(event) => {
            opener.current = event.currentTarget;
            modalOpen.current = true;
            stopPreview();
            setGalleryPlaying(true);
            setSelected(item);
          }}
        >
          {item.posterAvailable && (
            <Image
              className="motion-poster"
              src={item.posterSrc}
              alt={item.posterAlt}
              sizes={
                featured
                  ? "(max-width: 640px) 100vw, 1280px"
                  : "(max-width: 640px) 100vw, 55vw"
              }
              fill
              preload={featured}
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
          )}
          {item.videoAvailable && (
            <video
              className="motion-preview"
              preload="none"
              muted
              loop
              playsInline
              aria-hidden="true"
              onPlaying={(event) => {
                if (preview.current === event.currentTarget)
                  event.currentTarget.setAttribute("data-playing", "");
              }}
              onError={(event) => {
                if (preview.current === event.currentTarget) stopPreview();
              }}
            />
          )}
          {featured && (
            <span className="motion-badge">★ FEATURED SHOWREEL</span>
          )}
          {item.videoAvailable && (
            <span className="motion-play" aria-hidden="true">
              <Play
                size={featured ? 24 : 17}
                fill="currentColor"
                strokeWidth={0}
              />
            </span>
          )}
          <span className="motion-caption">
            <span>
              <span className="motion-label">
                {featured ? "Showreel" : "Motion Graphics"}
              </span>
              <span className="motion-title">{item.title}</span>
            </span>
            {featured && item.duration !== undefined && (
              <span className="motion-duration">
                {formatTime(item.duration)}
              </span>
            )}
            {!item.videoAvailable && (
              <span className="motion-duration">Unavailable</span>
            )}
          </span>
        </button>
      </article>
    );
  }

  const rows = (
    <div className={showreel ? "motion-rows" : "motion-rows featured-grid"}>
      {Array.from({ length: Math.ceil(projects.length / 2) }, (_, row) => (
        <div className="motion-row" key={row}>
          {projects.slice(row * 2, row * 2 + 2).map((item) => (
            <div className="motion-cell" key={item.id}>
              {card(item)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div className="motion-gallery">
      {showreel ? (
        <>
          {card(showreel, true)}
          <section className="motion-projects" aria-labelledby="category-0">
            <header className="work-categoryHeader">
              <span className="work-categoryIndex" aria-hidden="true">
                01
              </span>
              <h2 id="category-0">Motion Graphics</h2>
              <span className="work-categoryCount">
                {String(projects.length).padStart(2, "0")} PROJECTS
              </span>
            </header>
            {rows}
          </section>
        </>
      ) : (
        rows
      )}
      {selected && (
        <MotionDialog
          item={selected}
          onClose={() => {
            modalOpen.current = false;
            setSelected(null);
            setGalleryPlaying(false);
            opener.current?.focus({ preventScroll: true });
          }}
        />
      )}
    </div>
  );
}
