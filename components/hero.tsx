import { ArrowDown, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { MotionGallery } from "@/src/components/MotionGallery";
import { getShowreel } from "@/src/data/public-assets";
import { contact } from "@/src/data/site";
import { HeroBackground } from "./hero-background";
import { PageMotion } from "./page-motion";

export function Hero() {
  return (
    <section className="studio-hero" aria-labelledby="hero-title">
      <HeroBackground />
      <PageMotion className="studio-frame">
        <div className="studio-hero-grid">
          <div className="studio-hero-copy">
            <p className="studio-kicker" data-page-enter>
              <span aria-hidden="true" /> Video Editor &amp; Motion Designer
            </p>
            <h1
              id="hero-title"
              className="studio-hero-title"
              aria-label="Soumen Mandal"
            >
              <span className="studio-name-mask">
                <span data-title-enter>Soumen</span>
              </span>
              <span className="studio-name-mask">
                <span data-title-enter>
                  <em>Mandal</em>
                  <i aria-hidden="true">.</i>
                </span>
              </span>
            </h1>
            <p className="studio-hero-description" data-page-enter>
              I shape raw footage into stories and turn ideas into motion.
            </p>
            <div className="studio-actions" data-page-enter>
              <Link
                href="#work"
                className="studio-button studio-button-primary"
                data-magnetic=""
              >
                Explore work <ArrowDown size={16} aria-hidden="true" />
              </Link>
              <Link
                href="#hire"
                className="studio-button studio-button-text"
                data-magnetic=""
              >
                Get in touch <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div className="studio-hero-visual">
            <p className="studio-reel-label" aria-hidden="true">
              Featured showreel
            </p>
            <MotionGallery
              showreel={getShowreel()}
              projects={[]}
              variant="hero"
            />
          </div>
        </div>
        <div className="studio-hero-meta">
          <span>{contact.location}</span>
          <span className="availability">
            <span aria-hidden="true" /> Available for projects
          </span>
          <span className="studio-scroll-cue" aria-hidden="true">
            Scroll to explore <ArrowDown size={13} />
          </span>
        </div>
      </PageMotion>
    </section>
  );
}
