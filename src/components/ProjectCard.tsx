import type { Project } from "@/src/data/projects";
import { VideoPlayer } from "./VideoPlayer";
import "./work.css";

interface Props {
  project: Project;
  videoAvailable: boolean;
  posterAvailable: boolean;
}

export function ProjectCard({
  project,
  videoAvailable,
  posterAvailable,
}: Props) {
  const titleId = `${project.id}-title`;

  return (
    <article id={project.id} className="work-card" aria-labelledby={titleId}>
      <VideoPlayer
        title={project.title}
        videoSrc={project.videoSrc}
        portrait={project.category === "Short-Form Editing"}
        posterSrc={posterAvailable ? project.posterSrc : undefined}
        videoAvailable={videoAvailable}
      />
      <div className="work-cardDetails">
        <div>
          <p className="work-projectCategory">{project.category}</p>
          <h3 id={titleId}>{project.title}</h3>
        </div>
        <p className="work-projectType">{project.type}</p>
      </div>
    </article>
  );
}
