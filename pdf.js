(function () {
  if (window.__PDFX_PATCH__) return;
  window.__PDFX_PATCH__ = true;

  // ===== Minimal modal so you can see it working =====
  function ensureModal() {
    if (document.getElementById('pdfx-overlay')) return;
    const style = document.createElement('style');
    style.textContent = `
      #pdfx-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:999999}
      #pdfx-overlay[hidden]{display:none}
      .pdfx-modal{background:#fff;border-radius:12px;min-width:320px;max-width:90vw;padding:20px;box-shadow:0 16px 50px rgba(0,0,0,.3)}
      .pdfx-actions{display:flex;justify-content:flex-end;margin-top:12px;gap:8px}
      .pdfx-btn{padding:8px 12px;border-radius:8px;border:1px solid rgba(0,0,0,.12);background:#fff;cursor:pointer}
      .pdfx-primary{background:#e84e2c;border-color:#e84e2c;color:#fff}
    `;
    const overlay = document.createElement('div');
    overlay.id = 'pdfx-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="pdfx-modal" role="dialog" aria-modal="true">
        <h3 style="margin:0 0 8px 0;">Export to PDF</h3>
        <div>🎉 Trigger detected. (This is the simplified modal.)</div>
        <div class="pdfx-actions">
          <button class="pdfx-btn" data-close>Close</button>
          <button class="pdfx-btn pdfx-primary" data-close>OK</button>
        </div>
      </div>`;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.hasAttribute('data-close')) overlay.hidden = true;
    });
    document.head.appendChild(style);
    document.body.appendChild(overlay);
  }
  function openModal() {
    ensureModal();
    document.getElementById('pdfx-overlay').hidden = false;
  }

  // ===== Trigger detection (hash or ?export=pdf) =====
  function checkTriggerFromUrl() {
    try {
      const u = new URL(location.href);
      const viaHash = u.hash === '#export-pdf';
      const viaQuery = u.searchParams.get('export') === 'pdf';
      if (viaHash || viaQuery) {
        // Clean it so back/forward doesn’t keep reopening
        history.replaceState(null, '', location.pathname + (viaQuery ? '' : u.search));
        openModal();
        return true;
      }
    } catch {}
    return false;
  }

  // ===== Robust URL watcher for SPA navigations =====
  let lastHref = location.href;
  function tickUrlWatcher() {
    if (location.href !== lastHref) {
      lastHref = location.href;
      checkTriggerFromUrl();
    }
  }
  const urlWatchInterval = setInterval(tickUrlWatcher, 200); // lightweight poll

  // Also attempt native events when they *do* fire
  window.addEventListener('hashchange', checkTriggerFromUrl);
  window.addEventListener('popstate', checkTriggerFromUrl);
  document.addEventListener('DOMContentLoaded', checkTriggerFromUrl);

  // ===== Direct click interception on contextual menu item =====
  // Mintlify may portal the menu; we’ll watch the DOM and bind clicks when the item appears.
  function bindContextualItem(root = document) {
    const anchors = root.querySelectorAll('a[href="#export-pdf"], a[href*="?export=pdf"]');
    anchors.forEach(a => {
      if (a.__pdfxBound) return;
      a.__pdfxBound = true;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        // make sure URL reflects the action (so reload/back would be consistent)
        if (location.hash !== '#export-pdf') {
          history.pushState(null, '', location.pathname + location.search + '#export-pdf');
        }
        openModal();
      }, true); // capture = true helps across portals
    });
  }

  // Observe the whole document for late-mounted menu trees
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'childList') {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === 1) bindContextualItem(n);
        });
      } else if (m.type === 'attributes' && m.target.nodeType === 1) {
        bindContextualItem(m.target);
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true });

  // Initial pass
  bindContextualItem(document);
  // If the page already has the trigger (e.g., direct link), open now
  checkTriggerFromUrl();
})();
