// This head script runs per document load. Next Link navigation preserves the document.
// Release the page if the client bundle never hydrates.
export const introBootstrap = `
  try {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      var root = document.documentElement;
      root.dataset.intro = "pending";
      window.setTimeout(function () {
        if (root.dataset.intro === "pending") delete root.dataset.intro;
      }, 4500);
    }
  } catch {}
`;
