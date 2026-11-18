import { ArrowDownRight, ArrowUpRight, Play } from "lucide-react";
import Image from "next/image";
import { contact, socialProfiles } from "@/src/data/site";
import type { ExhibitMedia, Stop } from "./types";
import type { MouseEvent, ReactNode } from "react";

export const tools = [
  { icon: "/icons/adobe-premiere-pro.svg", name: "Adobe Premiere Pro" },
  { icon: "/icons/adobe-after-effects.svg", name: "Adobe After Effects" },
  { icon: "/icons/adobe-photoshop.svg", name: "Adobe Photoshop" },
  { icon: "/icons/adobe-illustrator.svg", name: "Adobe Illustrator" },
];

const stats = [
  ["2+", "Years experience"],
  ["30+", "Projects completed"],
  ["2", "Creative disciplines"],
];

type OpenVideo = (item: ExhibitMedia, origin: HTMLElement) => void;

function MediaLink({
  item,
  onOpen,
  children,
  className,
}: {
  item: ExhibitMedia;
  onOpen: OpenVideo;
  children: ReactNode;
  className: string;
}) {
  if (!item.videoAvailable) return null;
  function play(event: MouseEvent<HTMLAnchorElement>) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    onOpen(item, event.currentTarget);
  }

  return (
    <a
      className={className}
      href={item.videoSrc}
      aria-label={"Play " + item.title}
      aria-haspopup="dialog"
      onClick={play}
    >
      {children}
    </a>
  );
}

function Poster({
  item,
  onOpen,
  portrait,
}: {
  item: ExhibitMedia;
  onOpen: OpenVideo;
  portrait?: boolean;
}) {
  return (
    <figure
      className={portrait ? "exhibit-poster is-portrait" : "exhibit-poster"}
    >
      {item.posterAvailable && (
        <Image
          src={item.posterSrc}
          alt={item.posterAlt}
          fill
          sizes="(max-width: 750px) 94vw, 58vw"
        />
      )}
      <MediaLink item={item} className="poster-play" onOpen={onOpen}>
        <Play size={20} fill="currentColor" aria-hidden="true" />
      </MediaLink>
    </figure>
  );
}

export function Arrival({
  item,
  onOpen,
}: {
  item: ExhibitMedia;
  onOpen: OpenVideo;
}) {
  return (
    <div className="arrival-layout">
      <div className="arrival-copy">
        <p className="exhibit-kicker">
          <span /> Video Editor &amp; Motion Designer
        </p>
        <h1 id="home-title">
          Soumen
          <em>
            Mandal<span>.</span>
          </em>
        </h1>
        <p className="arrival-summary">
          I shape raw footage into stories and turn ideas into motion.
        </p>
        <div className="exhibit-actions">
          <a className="exhibit-button is-primary" href="#showreel">
            Enter exhibition <ArrowDownRight size={18} />
          </a>
          <MediaLink
            item={item}
            className="exhibit-button is-quiet"
            onOpen={onOpen}
          >
            <Play size={14} fill="currentColor" /> Play showreel
          </MediaLink>
        </div>
      </div>
      <Poster item={item} onOpen={onOpen} />
      <div className="arrival-caption" aria-hidden="true">
        <span>Featured showreel</span>
        <span>
          Scroll to explore <ArrowDownRight size={14} />
        </span>
      </div>
    </div>
  );
}

export function MediaContent({
  stop,
  onOpen,
  related,
}: {
  stop: Stop & { item: ExhibitMedia };
  onOpen: OpenVideo;
  related: Stop[];
}) {
  const item = stop.item;
  const [title, subtitle] = item.title.split(" — ", 2);
  const number = related.findIndex((entry) => entry.id === stop.id) + 1;
  const stamp =
    item.duration === undefined
      ? null
      : new Date(item.duration * 1000).toISOString().slice(14, 19);
  return (
    <div
      className={
        "media-layout" +
        (stop.side === -1 ? " media-left" : "") +
        (stop.portrait ? " media-portrait" : "")
      }
    >
      <div className="media-copy">
        <p className="exhibit-kicker">
          {stop.chapter === 1 ? "★ " : ""}
          {item.category}
          {related.length > 1 && (
            <span className="media-number">
              {String(number).padStart(2, "0")} /{" "}
              {String(related.length).padStart(2, "0")}
            </span>
          )}
        </p>
        <h2 id={stop.id + "-title"} aria-label={item.title}>
          {title}
          {subtitle && <span className="media-subtitle">{subtitle}</span>}
        </h2>
        {item.description && (
          <p className="exhibit-description">{item.description}</p>
        )}
        <MediaLink
          item={item}
          className="exhibit-button is-primary"
          onOpen={onOpen}
        >
          <Play size={15} fill="currentColor" /> Play{" "}
          {stop.chapter === 1 ? "showreel" : "film"}
          {stamp && <span className="media-time">{stamp}</span>}
        </MediaLink>
        {related.length > 1 && (
          <nav className="film-index" aria-label="Motion graphics projects">
            {related.map((entry, index) => (
              <a
                key={entry.id}
                href={"#" + entry.id}
                aria-current={entry.id === stop.id ? "location" : undefined}
                aria-label={entry.label}
              >
                {String(index + 1).padStart(2, "0")}
              </a>
            ))}
          </nav>
        )}
      </div>
      <Poster item={item} onOpen={onOpen} portrait={stop.portrait} />
    </div>
  );
}

export function Bio() {
  return (
    <div className="bio-layout">
      <header>
        <p className="exhibit-kicker">
          <span /> Info / About
        </p>
        <h2 id="info-title">
          Behind
          <br /> the <em>edit.</em>
        </h2>
      </header>
      <div className="bio-copy" data-reading="">
        <p>
          I&apos;m <strong>Soumen Mandal</strong>, a video editor and motion
          designer based in Kolkata, India. I love turning simple ideas into
          visuals that feel sharp, expressive, and worth watching.
        </p>
        <p>
          From fast-paced short-form edits to clean motion graphics and
          SaaS-inspired animations, I enjoy exploring rhythm, typography,
          storytelling, and the little details that make a project stand out.
        </p>
        <p>
          I&apos;m constantly experimenting, learning, and pushing my creative
          skills further. For me, every project is an opportunity to make
          something better than the last.
        </p>
        <a className="exhibit-button is-quiet" href="#tools">
          Software &amp; tools <ArrowDownRight size={17} />
        </a>
      </div>
    </div>
  );
}

export function Tools() {
  return (
    <div className="tools-layout" data-reading="">
      <header>
        <p className="exhibit-kicker">
          <span /> The edit suite
        </p>
        <h2 id="tools-title">
          My creative <em>tools.</em>
        </h2>
      </header>
      <dl className="exhibit-stats">
        {stats.map(([value, label]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <ul className="suite-tools" aria-label="Software">
        {tools.map(({ icon, name }) => (
          <li key={name}>
            <Image src={icon} alt="" width={24} height={24} unoptimized />
            {name}
          </li>
        ))}
      </ul>
      <div className="chiku-note">
        <h3>Soumen / Chiku</h3>
        <p>
          You might have spotted &apos;Designed by Chiku&apos; in some of my
          edits. Chiku is the name I create under, a different signature for the
          same work.
        </p>
      </div>
    </div>
  );
}

export function ContactContent({
  onInquiry,
}: {
  onInquiry: (origin: HTMLElement) => void;
}) {
  const socials = Object.entries(socialProfiles).filter(
    ([, url]) => url && URL.canParse(url) && new URL(url).protocol === "https:",
  );
  return (
    <div className="finale-layout">
      <div className="finale-copy">
        <p className="exhibit-kicker">
          <span /> Available for projects
        </p>
        <h2 id="hire-title">
          Let&apos;s make
          <br />
          it <em>move.</em>
        </h2>
        <p className="exhibit-description">
          Have a project in mind? I&apos;d love to hear about it.
        </p>
        <div className="exhibit-actions">
          <button
            className="exhibit-button is-primary"
            type="button"
            aria-haspopup="dialog"
            onClick={(event) => onInquiry(event.currentTarget)}
          >
            Start a project <ArrowUpRight size={18} />
          </button>
          <a
            className="exhibit-button is-quiet"
            href={"mailto:" + contact.email}
          >
            {contact.email} <ArrowUpRight size={15} />
          </a>
        </div>
        {socials.length > 0 && (
          <nav aria-label="Social profiles" className="exhibit-socials">
            {socials.map(([name, url]) => (
              <a key={name} href={url ?? undefined}>
                {name}
              </a>
            ))}
          </nav>
        )}
      </div>
      <footer className="exhibit-footer">
        <span>Soumen Mandal · {contact.location}</span>
        <a href="#home">
          Back to arrival <ArrowUpRight size={14} />
        </a>
      </footer>
    </div>
  );
}
