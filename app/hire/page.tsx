import type { Metadata } from "next";
import { HireForm } from "@/components/hire-form";
import { PageMotion } from "@/components/page-motion";
import { contact } from "@/src/data/site";

export const metadata: Metadata = {
  title: "Hire Me",
  description:
    "Get in touch with Soumen Mandal about video editing and motion design projects.",
};

export default function HirePage() {
  return (
    <PageMotion className="editorial-page hire-page">
      <header className="editorial-header">
        <h1 className="editorial-title" data-page-enter>
          LET&apos;S WORK <span>TOGETHER</span>
        </h1>
        <p className="editorial-lead" data-page-enter>
          Have a project in mind? Whether it&apos;s a short-form edit, motion
          graphics, or something a little different, I&apos;d love to hear about
          it.
        </p>
      </header>
      <div className="hire-body" data-page-enter>
        <HireForm />
        <p className="hire-direct">
          You can also email me at{" "}
          <a href={`mailto:${contact.email}`}>{contact.email}</a>.
        </p>
      </div>
    </PageMotion>
  );
}
