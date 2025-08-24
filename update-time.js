// last-updated.js (place this file in your docs content folder so Mintlify loads it globally)

(function () {
  // --- CHANGE THESE TWO ---
  const repo = "your-org/your-repo";     // e.g. "blockaidco/docs"
  const mdxRoot = "";                    // e.g. "" or "docs/" if your MDX live in /docs

  // Try to infer the MDX path from the URL.
  // /my-folder/my-article  -> my-folder/my-article.mdx
  // /my-folder             -> my-folder/index.mdx
  function guessFilePath() {
    let p = window.location.pathname.replace(/^\/|\/$/g, ""); // trim leading/trailing slash
    if (!p) return mdxRoot + "index.mdx";
    // If path ends with a slash or is a folder route, assume index.mdx
    return mdxRoot + (p.endsWith("/") ? p + "index.mdx" : p + ".mdx");
  }

  function insertLastUpdated(text) {
    // Put it at the end of the main content area if available, otherwise body
    const content = document.querySelector('[data-identifier="content-area"], main, .mdx-content') || document.body;
    const p = document.createElement("p");
    p.id = "last-updated";
    p.style.fontSize = "0.9em";
    p.style.opacity = "0.75";
    p.style.marginTop = "1rem";
    p.textContent = text;
    content.appendChild(p);
  }

  async function showLastUpdated() {
    const filePath = guessFilePath();
    const url = `https://api.github.com/repos/${repo}/commits?path=${encodeURIComponent(filePath)}&per_page=1`;

    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) return;

      const iso = data[0].commit.committer.date; // or author.date
      const d = new Date(iso);
      const formatted = d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
      insertLastUpdated(`Last updated: ${formatted}`);
    } catch (_) {
      /* ignore */
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showLastUpdated);
  } else {
    showLastUpdated();
  }
})();
