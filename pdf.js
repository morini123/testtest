// Mintlify Contextual Menu → Export to PDF (full version)
// - Opens a modal when the contextual item (href "#export-pdf") is clicked
// - Lets users select one/many pages from the left sidebar
// - Compiles them into a single client-side PDF via html2pdf.js
// - Works with SPA navigation via URL watcher + direct click interception

(function () {
  if (window.__PDFX_FULL__) return;
  window.__PDFX_FULL__ = true;

  // -------------------------
  // Helpers
  // -------------------------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const slug = (s='') => s.trim().toLowerCase().replace(/[^\w\-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');

  function findArticle(root = document) {
    // Try several Mintlify patterns; fallback to main
    return (
      root.querySelector('main article') ||
      root.querySelector('main [data-content]') ||
      root.querySelector('main .prose') ||
      root.querySelector('main') ||
      root.body ||
      root
    );
  }

  function loadHtml2Pdf() {
    return new Promise((resolve, reject) => {
      if (window.html2pdf) return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load html2pdf'));
      document.head.appendChild(s);
    });
  }

  // -------------------------
  // Modal UI
  // -------------------------
  const MODAL_HTML = `
    <style id="pdfx-styles">
      #pdfx-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);backdrop-filter:saturate(1.2) blur(2px);z-index:999999;display:flex;align-items:center;justify-content:center}
      #pdfx-overlay[hidden]{display:none}
      .pdfx-modal{background:#fff;border-radius:12px;width:min(980px,94vw);max-height:84vh;box-shadow:0 16px 60px rgba(0,0,0,.25);display:flex;flex-direction:column;overflow:hidden}
      .pdfx-header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid rgba(0,0,0,.06)}
      .pdfx-title{margin:0;font-size:16px;font-weight:600}
      .pdfx-close{border:0;background:transparent;font-size:18px;cursor:pointer;line-height:1;padding:4px}
      .pdfx-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:0;min-height:420px}
      .pdfx-left{padding:14px;border-right:1px solid rgba(0,0,0,.06);display:flex;flex-direction:column}
      .pdfx-right{padding:14px;display:flex;flex-direction:column;justify-content:space-between}
      .pdfx-search-wrap{padding:2px 0 10px 0}
      .pdfx-search{width:100%;padding:10px 12px;border-radius:8px;border:1px solid rgba(0,0,0,.12)}
      .pdfx-list{overflow:auto;border:1px solid rgba(0,0,0,.06);border-radius:8px;padding:8px;background:#fafafa;min-height:280px}
      .pdfx-row{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;padding:6px 8px;border-radius:8px}
      .pdfx-row:hover{background:#fff}
      .pdfx-title-txt{font-weight:500}
      .pdfx-path{opacity:.6;font-size:12px}
      .pdfx-footer-left{display:flex;justify-content:space-between;align-items:center;padding-top:8px;font-size:12px}
      .pdfx-check{display:flex;gap:6px;align-items:center;user-select:none}
      .pdfx-bar{display:flex;gap:8px;align-items:center;margin:8px 0 10px 0;flex-wrap:wrap}
      .pdfx-chip{font-size:12px;border:1px solid rgba(0,0,0,.12);border-radius:999px;padding:6px 10px;background:#fff;cursor:pointer}
      .pdfx-opts{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:0 0 6px}
      .pdfx-label{font-size:12px;opacity:.7}
      .pdfx-actions{display:flex;justify-content:flex-end;gap:8px;padding-top:10px}
      .pdfx-btn{padding:10px 14px;border-radius:10px;border:1px solid rgba(0,0,0,.12);cursor:pointer;background:#fff}
      .pdfx-btn.primary{background:#e84e2c;border-color:#e84e2c;color:#fff}
      .pdfx-note{opacity:.65;font-size:12px}
      .pdfx-article-header{border-bottom:1px solid rgba(0,0,0,.08);padding-bottom:10px;margin-bottom:12px}
      .pdfx-article-title{margin:0;font-size:20px}
      .pdfx-article-path{opacity:.55;font-size:12px}
      @media print { .html2pdf__page-break{break-after:page} }
    </style>
    <div id="pdfx-overlay" hidden>
      <div class="pdfx-modal" role="dialog" aria-modal="true" aria-label="Export articles">
        <div class="pdfx-header">
          <h3 class="pdfx-title">Export to PDF</h3>
          <button class="pdfx-close" aria-label="Close">✕</button>
        </div>
        <div class="pdfx-grid">
          <aside class="pdfx-left">
            <div class="pdfx-bar">
              <button class="pdfx-chip" data-select-current>+ Select current page</button>
              <button class="pdfx-chip" data-select-visible>+ Select visible section</button>
            </div>
            <div class="pdfx-search-wrap">
              <input type="text" class="pdfx-search" placeholder="Search articles or paths…" />
            </div>
            <div class="pdfx-list"></div>
            <div class="pdfx-footer-left">
              <label class="pdfx-check"><input type="checkbox" id="pdfx-select-all"/> Select all</label>
              <span class="pdfx-count">0 article(s) selected</span>
            </div>
          </aside>
          <section class="pdfx-right">
            <div>
              <div class="pdfx-opts">
                <label class="pdfx-label">Paper</label>
                <select class="pdfx-paper">
                  <option value="a4|portrait" selected>A4 • Portrait</option>
                  <option value="a4|landscape">A4 • Landscape</option>
                  <option value="letter|portrait">US Letter • Portrait</option>
                  <option value="letter|landscape">US Letter • Landscape</option>
                </select>
                <label class="pdfx-label">Quality</label>
                <select class="pdfx-quality">
                  <option value="0.98" selected>High</option>
                  <option value="0.9">Medium</option>
                  <option value="0.8">Small file</option>
                </select>
              </div>
              <p class="pdfx-note">Pages are compiled in the order they appear in the left sidebar. You can search and toggle selections below.</p>
            </div>
            <div class="pdfx-actions">
              <button class="pdfx-btn pdfx-cancel">Cancel</button>
              <button class="pdfx-btn primary pdfx-export">Export PDF</button>
            </div>
          </section>
        </div>
      </div>
    </div>`;

  function ensureModal() {
    if (!document.getElementById('pdfx-overlay')) {
      const frag = document.createElement('div');
      frag.innerHTML = MODAL_HTML;
      // append <style> then overlay
      const style = frag.firstElementChild;
      const overlay = frag.lastElementChild;
      document.head.appendChild(style);
      document.body.appendChild(overlay);
    }
  }
  function openModal() {
    ensureModal();
    $('#pdfx-overlay').hidden = false;
    buildList(); // refresh list for current section
  }
  function closeModal() {
    const ov = $('#pdfx-overlay');
    if (ov) ov.hidden = true;
  }

  // -------------------------
  // Read sidebar → items
  // -------------------------
  function readSidebar() {
    // visible left-nav links, internal only
    const links = $$('aside a[href^="/"]:not([href="#"])');
    const seen = new Set();
    const out = [];
    for (const a of links) {
      try {
        const u = new URL(a.getAttribute('href'), location.origin);
        if (seen.has(u.pathname)) continue;
        seen.add(u.pathname);
        const title = (a.textContent || '').trim() || u.pathname.split('/').filter(Boolean).pop();
        out.push({ title, path: u.pathname });
      } catch {}
    }
    return out;
  }

  let cachedItems = [];
  function buildList() {
    cachedItems = readSidebar();
    const list = $('.pdfx-list');
    if (!list) return;
    list.innerHTML = cachedItems.map(it => `
      <label class="pdfx-row">
        <input type="checkbox" class="pdfx-item" data-path="${it.path}" data-title="${it.title.replace(/"/g,'&quot;')}" />
        <span class="pdfx-title-txt">${it.title}</span>
        <span class="pdfx-path">${it.path}</span>
      </label>
    `).join('');
    updateCount();
  }

  function updateCount() {
    const n = $$('.pdfx-item:checked').length;
    const el = $('.pdfx-count');
    if (el) el.textContent = `${n} article(s) selected`;
  }

  // -------------------------
  // Fetch → compile → export
  // -------------------------
  async function fetchArticle(pathname) {
    const res = await fetch(pathname, { credentials: 'same-origin' });
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const main = findArticle(doc).cloneNode(true);

    // Remove interactive bits that can distort export
    main.querySelectorAll('button, [role="button"], .no-print, .copy, .clipboard, .code-action, [data-rehype-pretty-code-title]')
        .forEach(n => n.remove());

    // Expand <details> so content shows in PDF
    main.querySelectorAll('details').forEach(d => d.open = true);

    return main;
  }

  async function doExport() {
    await loadHtml2Pdf();

    const selected = $$('.pdfx-item:checked').map(cb => ({
      title: cb.dataset.title, path: cb.dataset.path
    }));
    if (!selected.length) return alert('Select at least one article.');

    const [format, orientation] = ($('.pdfx-paper').value || 'a4|portrait').split('|');
    const quality = parseFloat($('.pdfx-quality').value || '0.98');

    const wrap = document.createElement('div');
    wrap.className = 'pdfx-wrap';

    // Simple progress UI on the button
    const exportBtn = $('.pdfx-export');
    const prevLabel = exportBtn.textContent;
    exportBtn.disabled = true; exportBtn.textContent = 'Exporting…';

    try {
      for (let i = 0; i < selected.length; i++) {
        const { title, path } = selected[i];
        const section = document.createElement('section');
        section.className = 'pdfx-article';

        const header = document.createElement('header');
        header.className = 'pdfx-article-header';
        header.innerHTML = `<h1 class="pdfx-article-title">${title}</h1>
                            <div class="pdfx-article-path">${location.origin}${path}</div>`;
        section.appendChild(header);

        const body = await fetchArticle(path);
        section.appendChild(body);
        wrap.appendChild(section);

        if (i < selected.length - 1) {
          const br = document.createElement('div');
          br.className = 'html2pdf__page-break';
          wrap.appendChild(br);
        }
      }

      const fname = `blockaid-docs_${slug(selected[0].title)}${selected.length>1?`-and-${selected.length-1}-more`:''}.pdf`;
      const options = {
        margin: [10, 12, 14, 12],
        filename: fname,
        image: { type: 'jpeg', quality },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF: { unit: 'mm', format, orientation },
        pagebreak: { mode: ['css', 'legacy'] }
      };

      await window.html2pdf().set(options).from(wrap).save();
      closeModal();
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Export failed: ' + (err?.message || err));
    } finally {
      exportBtn.disabled = false; exportBtn.textContent = prevLabel;
    }
  }

  // -------------------------
  // URL trigger + direct click interception (for SPA)
  // -------------------------
  function checkTriggerFromUrl() {
    try {
      const u = new URL(location.href);
      const viaHash = u.hash === '#export-pdf';
      const viaQuery = u.searchParams.get('export') === 'pdf';
      if (viaHash || viaQuery) {
        // Clean so back/forward doesn’t keep reopening
        history.replaceState(null, '', location.pathname + (viaQuery ? '' : u.search));
        openModal();
        return true;
      }
    } catch {}
    return false;
  }

  // Poll location to catch SPA nav changes
  let lastHref = location.href;
  function tickUrlWatcher() {
    if (location.href !== lastHref) {
      lastHref = location.href;
      checkTriggerFromUrl();
    }
  }
  setInterval(tickUrlWatcher, 200);

  // Native events when they fire
  window.addEventListener('hashchange', checkTriggerFromUrl);
  window.addEventListener('popstate', checkTriggerFromUrl);

  // Bind clicks on the contextual item even if it’s rendered in a portal
  function bindContextualClicks(root = document) {
    const anchors = root.querySelectorAll('a[href="#export-pdf"], a[href*="?export=pdf"]');
    anchors.forEach(a => {
      if (a.__pdfxBound) return;
      a.__pdfxBound = true;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        if (location.hash !== '#export-pdf') {
          history.pushState(null, '', location.pathname + location.search + '#export-pdf');
        }
        openModal();
      }, true); // capture helps with portals
    });
  }
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'childList') {
        m.addedNodes.forEach(n => { if (n.nodeType === 1) bindContextualClicks(n); });
      } else if (m.type === 'attributes' && m.target.nodeType === 1) {
        bindContextualClicks(m.target);
      }
    }
    // If modal is open and nav changed, refresh the list
    if ($('#pdfx-overlay') && !$('#pdfx-overlay').hidden) buildList();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true });

  // -------------------------
  // Modal event wiring
  // -------------------------
  function attachModalEvents() {
    const ov = $('#pdfx-overlay');
    if (!ov) return;

    ov.addEventListener('click', (e) => {
      if (e.target === ov) closeModal();
      if (e.target.matches('.pdfx-close, .pdfx-cancel')) closeModal();
    });

    ov.addEventListener('input', (e) => {
      if (e.target.matches('.pdfx-search')) {
        const q = e.target.value.trim().toLowerCase();
        $$('.pdfx-row').forEach(row => {
          const t = row.querySelector('.pdfx-title-txt').textContent.toLowerCase();
          const p = row.querySelector('.pdfx-path').textContent.toLowerCase();
          row.hidden = !(t.includes(q) || p.includes(q));
        });
      }
      if (e.target.matches('#pdfx-select-all')) {
        const checked = e.target.checked;
        $$('.pdfx-item:not(:disabled)').forEach(cb => (cb.checked = checked));
        updateCount();
      }
      if (e.target.matches('.pdfx-item')) updateCount();
    });

    ov.addEventListener('click', async (e) => {
      if (e.target.matches('.pdfx-export')) {
        e.preventDefault();
        await doExport();
      }
      if (e.target.matches('[data-select-current]')) {
        // Tick only the current page
        const here = location.pathname;
        $$('.pdfx-item').forEach(cb => cb.checked = (cb.dataset.path === here));
        updateCount();
      }
      if (e.target.matches('[data-select-visible]')) {
        // Select everything currently visible (i.e., not hidden by search)
        $$('.pdfx-row').forEach(row => {
          if (!row.hidden) row.querySelector('.pdfx-item').checked = true;
        });
        updateCount();
      }
    });
  }

  // -------------------------
  // Boot
  // -------------------------
  function ready(fn){
    (document.readyState === 'complete' || document.readyState === 'interactive')
      ? fn()
      : document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  ready(() => {
    ensureModal();
    attachModalEvents();
    bindContextualClicks(document);

    // Open immediately if URL already has trigger
    checkTriggerFromUrl();
  });
})();
