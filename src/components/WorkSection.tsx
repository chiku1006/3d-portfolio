import {
  featuredShowreel,
  motionGalleryProjects,
  projectCategories,
  projects,
  type GalleryMedia,
} from "@/src/data/projects";
import { readMp4Duration } from "@/src/data/mp4-duration";
import { hasPublicAsset } from "@/src/data/public-assets";
import { MotionGallery } from "./MotionGallery";
import { ProjectCard } from "./ProjectCard";
import "./work.css";

function withAvailability(item: GalleryMedia) {
  return {
    ...item,
    videoAvailable: hasPublicAsset(item.videoSrc),
    posterAvailable: hasPublicAsset(item.posterSrc),
  };
}

export function WorkSection() {
  return (
    <section id="work" aria-labelledby="work-title" className="work-section">
      <div className="work-container">
        <header className="work-sectionHeader">
          <div data-page-enter>
            <p className="work-eyebrow">SELECTED WORK</p>
            <h1 id="work-title" className="work-title">
              My Work<span>.</span>
            </h1>
          </div>
          <p className="work-intro" data-page-enter>
            Video editing &amp; motion design.
            <br />A closer look at the work.
          </p>
        </header>
        <div className="work-categories">
          <MotionGallery
            showreel={{
              ...withAvailability(featuredShowreel),
              duration: readMp4Duration(featuredShowreel.videoSrc),
            }}
            projects={motionGalleryProjects.map(withAvailability)}
          />
          {projectCategories.map((category, index) => {
            if (category === "Motion Graphics") return null;
            const entries = projects
              .filter((project) => project.category === category)
              .sort((a, b) => a.order - b.order);
            if (!entries.length) return null;
            return (
              <section key={category} aria-labelledby={`category-${index}`}>
                <header className="work-categoryHeader">
                  <span className="work-categoryIndex" aria-hidden="true">
                    0{index + 1}
                  </span>
                  <h2 id={`category-${index}`}>{category}</h2>
                  <span className="work-categoryCount">
                    {String(entries.length).padStart(2, "0")}{" "}
                    {entries.length === 1 ? "PROJECT" : "PROJECTS"}
                  </span>
                </header>
                <div
                  className={
                    entries.length === 1
                      ? "work-grid work-singleProject"
                      : "work-grid"
                  }
                >
                  {entries.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      videoAvailable={hasPublicAsset(project.videoSrc)}
                      posterAvailable={hasPublicAsset(project.posterSrc)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}
