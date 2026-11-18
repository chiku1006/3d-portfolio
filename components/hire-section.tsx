import { HireForm } from "@/components/hire-form";
import { PageMotion } from "@/components/page-motion";
import { contact } from "@/src/data/site";

export function HireSection() {
  return (
    <section
      id="hire"
      className="editorial-page hire-page one-page-section"
      aria-labelledby="hire-title"
      tabIndex={-1}
    >
      <PageMotion>
        <header className="editorial-header">
          <p className="editorial-eyebrow editorial-label" data-scroll-reveal>
            Project inquiries
          </p>
          <h2 id="hire-title" className="editorial-title" data-scroll-reveal>
            Let&apos;s work <em>together.</em>
          </h2>
          <p className="editorial-lead" data-scroll-reveal>
            Have a project in mind? Whether it&apos;s a short-form edit, motion
            graphics, or something a little different, I&apos;d love to hear
            about it.
          </p>
          <div className="hire-direct" data-scroll-reveal>
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
            <p className="availability">
              <span aria-hidden="true" /> Available for projects
            </p>
          </div>
        </header>
        <div className="hire-body" data-scroll-reveal>
          <HireForm />
        </div>
      </PageMotion>
    </section>
  );
}
