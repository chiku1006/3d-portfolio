import { Exhibition } from "@/components/exhibition/exhibition";
import type { Stop } from "@/components/exhibition/types";
import { motionGalleryProjects, projects } from "@/src/data/projects";
import { getShowreel, withMediaAvailability } from "@/src/data/public-assets";
import "./exhibition.css";

export default function Home() {
  const motion: Stop[] = motionGalleryProjects.map((project, index) => ({
    id: index ? project.id : "work",
    chapter: 2,
    label: project.title,
    kind: "media",
    item: {
      ...withMediaAvailability(project),
      description: projects.find(({ id }) => id === project.id)?.description,
      category: "Motion Graphics",
    },
    side: index % 2 ? -1 : 1,
  }));
  const edits: Stop[] = projects
    .filter(({ category }) => category === "Short-Form Editing")
    .sort((a, b) => a.order - b.order)
    .map((project, index) => ({
      id: index ? project.id : "short-form",
      chapter: 3,
      label: project.title,
      kind: "media",
      item: { ...withMediaAvailability(project), category: project.category },
      side: -1,
      portrait: true,
    }));

  const stops: Stop[] = [
    { id: "home", chapter: 0, label: "Arrival", kind: "arrival" },
    {
      id: "showreel",
      chapter: 1,
      label: "Showreel",
      kind: "media",
      item: { ...getShowreel(), category: "Featured Showreel" },
      side: 1,
    },
    ...motion,
    ...edits,
    { id: "info", chapter: 4, label: "About", kind: "bio" },
    { id: "tools", chapter: 4, label: "Software and tools", kind: "tools" },
    { id: "hire", chapter: 5, label: "Contact", kind: "contact" },
  ];

  return <Exhibition stops={stops} />;
}
