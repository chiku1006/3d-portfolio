import { Exhibition } from "@/components/exhibition/exhibition";
import type { ExhibitMedia, Stop } from "@/components/exhibition/types";
import { motionGalleryProjects, projects } from "@/src/data/projects";
import { getShowreel, withMediaAvailability } from "@/src/data/public-assets";
import "./exhibition.css";

export default function Home() {
  const motion: ExhibitMedia[] = motionGalleryProjects.map((project) => ({
    ...withMediaAvailability(project),
    description: projects.find(({ id }) => id === project.id)?.description,
    category: "Motion Graphics",
  }));
  const edits: ExhibitMedia[] = projects
    .filter(({ category }) => category === "Short-Form Editing")
    .sort((a, b) => a.order - b.order)
    .map((project) => ({
      ...withMediaAvailability(project),
      category: "Video Edits",
    }));

  const stops: Stop[] = [
    { id: "home", chapter: 0, kind: "arrival" },
    {
      id: "showreel",
      chapter: 1,
      kind: "media",
      items: [{ ...getShowreel(), category: "Featured Showreel" }],
      side: 1,
    },
    { id: "work", chapter: 2, kind: "media", items: motion, side: 1 },
    {
      id: "short-form",
      chapter: 3,
      kind: "media",
      items: edits,
      side: -1,
      portrait: true,
    },
    { id: "info", chapter: 4, kind: "bio" },
    { id: "tools", chapter: 4, kind: "tools" },
    { id: "hire", chapter: 5, kind: "contact" },
  ];

  return <Exhibition stops={stops} />;
}
