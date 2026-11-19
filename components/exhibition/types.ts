import type { GalleryMedia } from "@/src/data/projects";

export type ExhibitMedia = GalleryMedia & {
  category: string;
  description?: string;
  videoAvailable: boolean;
  posterAvailable: boolean;
  duration?: number;
};

type Station = {
  id: string;
  chapter: number;
};

export type MediaStop = Station & {
  kind: "media";
  items: ExhibitMedia[];
  side: 1 | -1;
  portrait?: boolean;
};

export type Stop =
  | MediaStop
  | (Station & { kind: "arrival" | "bio" | "tools" | "contact" });

export type TourMotion = {
  target: number;
  progress: number;
  active: number;
  moving: boolean;
  settling: boolean;
  snap: number;
  pointerX: number;
  pointerY: number;
  modal: boolean;
};

export const chapters = [
  { id: "home", label: "Arrival" },
  { id: "showreel", label: "Showreel" },
  { id: "work", label: "Motion graphics" },
  { id: "short-form", label: "Video edits" },
  { id: "info", label: "About" },
  { id: "hire", label: "Contact" },
] as const;
