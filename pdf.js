// Mintlify — Export to PDF (uses /search.json → /docs.json → sidebar; full modal; SPA-safe)
(function () {
  // ---------- helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const slug = (s='') => s.trim().toLowerCase().replace(/[^\w\-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
  const toURL = (u) => { try { return new URL(u, location.origin); } catch { return null; } };
  const toPath = (u) => (toURL(u) || {}).pathname || null;

  function findArticle(root = document) {
    return (
      root.querySelector('main article') ||
      root.querySelector('main [data-content]') ||
      root.querySelector('main .prose') ||
      root.querySelector('main') ||
      root.body || root
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

  // ---------- modal ----------
  const STYLE_ID = 'pdfx-styles';
  const OVERLAY_ID = 'pdfx-overlay';
  const CSS = `
    #${OVERLAY_ID}{position:fixed;inset:0;background:rgba(0,0,0,.35);backdrop-filter:saturate(1.2) blur(2px);z-index:999999;display:flex;align-items:center;justify-content:center}
    #${OVERLAY_ID}[hidden]{display:none}
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
  `;
  const MODAL = `
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
            <p class="pdfx-note">Pages are discovered from <code>/search.json</code> (fallback to <code>/docs.json</code>), plus the current page.</p>
          </div>
          <div class="pdfx-actions">
            <button class="pdfx-btn pdfx-cancel">Cancel</button>
            <button class="pdfx-btn primary pdfx-export">Export PDF</button>
          </div>
        </section>
      </div>
    </div>
  `;

  function ensureModal() {
    let style = document.getElementById(STYLE_ID);
    if (!style) { style = document.createElement('style'); style.id = STYLE_ID; document.head.appendChild(style); }
    style.textContent = CSS;
    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) { overlay = document.createElement('div'); overlay.id = OVERLAY_ID; overlay.hidden = true; document.body.appendChild(overlay); }
    overlay.innerHTML = MODAL;
  }
  function openModal() { ensureModal(); $('#'+OVERLAY_ID).hidden = false; buildList(); }
  function closeModal() { const ov = $('#'+OVERLAY_ID); if (ov) ov.hidden = true; }

  // ---------- build list: /search.json → /docs.json → sidebar → +current ----------
  let ROUTES_CACHE = null;

  async function routesFromSearchJson() {
    try {
      const r = await fetch('/search.json', { credentials: 'same-origin' });
      if (!r.ok) return [];
      const data = await r.json(); // Mintlify’s index: [{ url, title, section, content, ... }, ...]
      const seen = new Set();
      const items = [];
      for (const row of data || []) {
        const p = toPath(row.url);
        if (!p || seen.has(p)) continue;
        seen.add(p);
        const title = (row.title || row.section || p).trim();
        items.push({ title, path: p });
      }
      return items;
    } catch { return []; }
  }

  async function routesFromDocsJson() {
    const out = [];
    const seen = new Set();
    function push(title, href) {
      const p = toPath(href);
      if (!p || seen.has(p)) return;
      seen.add(p);
      out.push({ title: (title || p).trim(), path: p });
    }
    function walk(node, inheritedTitle) {
      if (!node || typeof node !== 'object') return;
      if (typeof node.href === 'string') push(node.title || node.name || inheritedTitle, node.href);
      if (typeof node.link === 'string') push(node.title || node.name || inheritedTitle, node.link);
      if (typeof node.path === 'string') push(node.title || node.name || inheritedTitle, node.path);
      for (const [k,v] of Object.entries(node)) {
        if (Array.isArray(v)) v.forEach(child => walk(child, node.title || node.name || inheritedTitle));
      }
    }
    try {
      for (const cand of ['/docs.json', '/mint.json']) {
        const r = await fetch(cand, { credentials: 'same-origin' });
        if (r.ok) { walk(await r.json(), ''); break; }
      }
      return out;
    } catch { return out; }
  }

  function routesFromSidebar() {
    const containers = Array.from(document.querySelectorAll('aside, aside nav, [data-radix-scroll-area-viewport] aside, [data-radix-scroll-area-viewport] nav'));
    const anchors = [];
    containers.forEach(c => anchors.push(...c.querySelectorAll('a[href]')));
    const seen = new Set();
    const items = [];
    anchors.forEach(a => {
      const p = toPath(a.getAttribute('href'));
      if (!p || seen.has(p)) return;
      seen.add(p);
      const title = (a.textContent || '').trim() || p.split('/').filter(Boolean).pop() || p;
      items.push({ title, path: p });
    });
    return items;
  }

  async function getRoutes() {
    if (ROUTES_CACHE) return ROUTES_CACHE;
    let items = await routesFromSearchJson();
    if (!items.length) items = await routesFromDocsJson();
    if (!items.length) items = routesFromSidebar();

    // Always include current page
    const here = location.pathname;
    const hereTitle = ($('h1')?.textContent || document.title || here).trim();
    if (!items.some(i => i.path === here)) items.unshift({ title: hereTitle, path: here });

    // de-dupe + sort
    const seen = new Set();
    items = items.filter(i => { if (seen.has(i.path)) return false; seen.add(i.path); return true; })
                 .sort((a,b) => a.path.localeCompare(b.path));

    ROUTES_CACHE = items;
    return items;
  }

  async function buildList() {
    const list = $('.pdfx-list'); if (!list) return;
    const items = await getRoutes();
    window.__PDFX_ITEMS__ = items;

    list.innerHTML = items.map(it => `
      <label class="pdfx-row">
        <input type="checkbox" class="pdfx-item" data-path="${it.path}" data-title="${it.title.replace(/"/g,'&quot;')}" />
        <span class="pdfx-title-txt">${it.title}</span>
        <span class="pdfx-path">${it.path}</span>
      </label>
    `).join('');
    const count = $('.pdfx-count'); if (count) count.textContent = '0 article(s) selected';
  }

  function updateCount() {
    const n = $$('.pdfx-item:checked').length;
    const el = $('.pdfx-count'); if (el) el.textContent = `${n} article(s) selected`;
  }

  // ---------- export ----------
  async function fetchArticle(pathname) {
    const res = await fetch(pathname, { credentials: 'same-origin' });
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const main = findArticle(doc).cloneNode(true);
    main.querySelectorAll('button, [role="button"], .no-print, .copy, .clipboard, .code-action, [data-rehype-pretty-code-title]')
      .forEach(n => n.remove());
    main.querySelectorAll('details').forEach(d => d.open = true);
    return main;
  }

  async function doExport() {
    await loadHtml2Pdf();
    const selected = $$('.pdfx-item:checked').map(cb => ({ title: cb.dataset.title, path: cb.dataset.path }));
    if (!selected.length) return alert('Select at least one article.');

    const [format, orientation] = ($('.pdfx-paper').value || 'a4|portrait').split('|');
    const quality = parseFloat($('.pdfx-quality').value || '0.98');

    const wrap = document.createElement('div'); wrap.className = 'pdfx-wrap';
    const btn = $('.pdfx-export'); const label = btn?.textContent || 'Export PDF';
    if (btn) { btn.disabled = true; btn.textContent = 'Exporting…'; }

    try {
      for (let i = 0; i < selected.length; i++) {
        const { title, path } = selected[i];
        const section = document.createElement('section'); section.className = 'pdfx-article';
        const header  = document.createElement('header'); header.className = 'pdfx-article-header';
        header.innerHTML = `<h1 class="pdfx-article-title">${title}</h1><div class="pdfx-article-path">${location.origin}${path}</div>`;
        section.appendChild(header);
        section.appendChild(await fetchArticle(path));
        wrap.appendChild(section);
        if (i < selected.length - 1) wrap.appendChild(Object.assign(document.createElement('div'), { className: 'html2pdf__page-break' }));
      }
      const fname = `blockaid-docs_${slug(selected[0].title)}${selected.length>1?`-and-${selected.length-1}-more`:''}.pdf`;
      const opts = {
        margin: [10, 12, 14, 12],
        filename: fname,
        image: { type: 'jpeg', quality },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF: { unit: 'mm', format, orientation },
        pagebreak: { mode: ['css', 'legacy'] }
      };
      await window.html2pdf().set(opts).from(wrap).save();
      closeModal();
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Export failed: ' + (err?.message || err));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = label; }
    }
  }

  // ---------- triggers + SPA handling ----------
  function checkTriggerFromUrl() {
    try {
      const u = new URL(location.href);
      const viaHash = u.hash === '#export-pdf';
      const viaQuery = u.searchParams.get('export') === 'pdf';
      if (viaHash || viaQuery) {
        history.replaceState(null, '', location.pathname + (viaQuery ? '' : u.search));
        openModal();
        return true;
      }
    } catch {}
    return false;
  }
  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      checkTriggerFromUrl();
      const ov = $('#'+OVERLAY_ID);
      if (ov && !ov.hidden) buildList();
    }
  }, 200);
  window.addEventListener('hashchange', checkTriggerFromUrl);
  window.addEventListener('popstate', checkTriggerFromUrl);

  function bindContextualClicks(root = document) {
    root.querySelectorAll('a[href="#export-pdf"], a[href*="?export=pdf"]').forEach(a => {
      if (a.__pdfxBound) return;
      a.__pdfxBound = true;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        if (location.hash !== '#export-pdf') history.pushState(null, '', location.pathname + location.search + '#export-pdf');
        openModal();
      }, true);
    });
  }
  const mo = new MutationObserver(muts => {
    muts.forEach(m => {
      if (m.type === 'childList') m.addedNodes.forEach(n => { if (n.nodeType === 1) bindContextualClicks(n); });
      if (m.type === 'attributes' && m.target.nodeType === 1) bindContextualClicks(m.target);
    });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true });

  // modal events (delegated)
  document.addEventListener('click', async (e) => {
    if (e.target.matches('#'+OVERLAY_ID)) closeModal();
    if (e.target.matches('.pdfx-close, .pdfx-cancel')) closeModal();

    if (e.target.matches('[data-select-current]')) {
      const here = location.pathname;
      // Ensure current page is in the list and selected
      const items = window.__PDFX_ITEMS__ || [];
      const inList = items.some(i => i.path === here);
      if (!inList) {
        const hereTitle = ($('h1')?.textContent || document.title || here).trim();
        const row = document.createElement('label');
        row.className = 'pdfx-row';
        row.innerHTML = `
          <input type="checkbox" class="pdfx-item" data-path="${here}" data-title="${hereTitle.replace(/"/g,'&quot;')}" />
          <span class="pdfx-title-txt">${hereTitle}</span>
          <span class="pdfx-path">${here}</span>`;
        $('.pdfx-list')?.prepend(row);
        items.unshift({ title: hereTitle, path: here });
        window.__PDFX_ITEMS__ = items;
      }
      $$('.pdfx-item').forEach(cb => cb.checked = (cb.dataset.path === here));
      updateCount();
    }

    if (e.target.matches('[data-select-visible]')) {
      $$('.pdfx-row').forEach(row => { if (!row.hidden) row.querySelector('.pdfx-item').checked = true; });
      updateCount();
    }

    if (e.target.matches('.pdfx-export')) {
      e.preventDefault();
      await doExport();
    }
  });

  document.addEventListener('input', (e) => {
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

  // boot
  function ready(fn){
    (document.readyState === 'complete' || document.readyState === 'interactive')
      ? fn()
      : document.addEventListener('DOMContentLoaded', fn, { once: true });
  }
  ready(() => {
    ensureModal();
    bindContextualClicks(document);
    checkTriggerFromUrl();
  });
})();
