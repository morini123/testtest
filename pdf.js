// --- sanity check: fire on load + when #export-pdf appears
(function () {
  console.log("[pdfx] boot");
  // add a small marker in the UI so we know it's running
  const badge = document.createElement("div");
  badge.textContent = "custom JS active";
  Object.assign(badge.style, {
    position: "fixed", left: "8px", bottom: "8px",
    background: "#111", color: "#fff", padding: "4px 8px",
    fontSize: "12px", borderRadius: "6px", zIndex: "999999"
  });
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(badge));

  function openTest() {
    if (location.hash === "#export-pdf") {
      alert("✅ Custom JS detected the #export-pdf trigger");
      // clear the hash so it doesn’t alert again on navigate/back
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  window.addEventListener("hashchange", openTest);
  window.addEventListener("popstate", openTest);
  document.addEventListener("DOMContentLoaded", openTest);
})();
