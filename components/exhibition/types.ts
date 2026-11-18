import type { GalleryMedia } from "@/src/data/projects";

export type ExhibitMedia = GalleryMedia & {
  category: string;
  description?: string;
  videoAvailable: boolean;
  posterAvailable: boolean;
  duration?: number;
};

export type Stop = {
  id: string;
  chapter: number;
  label: string;
  kind: "arrival" | "media" | "bio" | "tools" | "contact";
  item?: ExhibitMedia;
  side?: 1 | -1;
  portrait?: boolean;
};

export type TourMotion = {
  progress: number;
  active: number;
  pointerX: number;
  pointerY: number;
  modal: boolean;
};

export const chapters = [
  { id: "home", label: "Arrival" },
  { id: "showreel", label: "Showreel" },
  { id: "work", label: "Motion graphics" },
  { id: "short-form", label: "Short-form editing" },
  { id: "info", label: "About" },
  { id: "hire", label: "Contact" },
] as const;
