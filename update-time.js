// last-updated.js
(function () {
  const repo = "your-org/your-repo";   // e.g. "blockaidco/docs"
  const mdxRoot = "";                  // prefix if your files live under "docs/"

  function guessFilePath() {
    let path = window.location.pathname.replace(/^\/|\/$/g, ""); // trim slashes
    if (!path) return mdxRoot + "index.mdx";
    return mdxRoot + (path.endsWith("/") ? path + "index.mdx" : path + ".mdx");
  }

  async function showLastUpdated() {
    const filePath = guessFilePath();
    const url = `https://api.github.com/repos/${repo}/commits?path=${encodeURIComponent(filePath)}&per_page=1`;

    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const commits = await res.json();
      if (!commits.length) return;

      const iso = commits[0].commit.committer.date;
      const date = new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      const el = document.createElement("p");
      el.id = "last-updated";
      el.style.fontSize = "0.9em";
      el.style.opacity = "0.7";
      el.style.marginTop = "1rem";
      el.textContent = `Last updated: ${date}`;

      // inject at bottom of content
      const container = document.querySelector("main") || document.body;
      container.appendChild(el);
    } catch (e) {
      console.warn("Could not fetch last updated date", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showLastUpdated);
  } else {
    showLastUpdated();
  }
})();
