/* Mintlify: Contextual-menu "Export to PDF" (multi-article) */
(function () {
  // --- 0) tiny helpers ---
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // Load html2pdf once
  function loadHtml2Pdf() {
    return new Promise((resolve, reject) => {
      if (window.html2pdf) return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load html2pdf'));
      document.head.appendChild(s);
    });
  }

  // Heuristic: get main article container on a page
  function findArticle(root = document) {
    return root.querySelector('main article, main [data-content], main') || root.body || root;
  }

  // Normalize file name
  function slug(s) {
    return (s || '')
      .trim()
      .toLowerCase()
      .replace(/[^\w\-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  // --- 1) Modal UI ---
  const modalHTML = `
  <div id="pdfx-overlay" class="pdfx-overlay" hidden>
    <div class="pdfx-modal" role="dialog" aria-modal="true" aria-label="Export articles">
      <button class="pdfx-close" aria-label="Close">✕</button>
      <div class="pdfx-grid">
        <aside class="pdfx-left">
          <div class="pdfx-search-wrap">
            <input type="text" class="pdfx-search" placeholder="Search for category & article" />
          </div>
          <div class="pdfx-list"></div>
          <div class="pdfx-footer-left">
            <label class="pdfx-check"><input type="checkbox" id="pdfx-select-all"/> Select all</label>
            <span class="pdfx-count">0 article(s) selected</span>
          </div>
        </aside>
        <section class="pdfx-right">
          <div class="pdfx-opts">
            <label class="pdfx-label">PDF Template</label>
            <select class="pdfx-template">
              <option value="blockaid">Blockaid</option>
              <option value="clean">Clean (no cover)</option>
            </select>
            <label class="pdfx-label">Paper</label>
            <select class="pdfx-paper">
              <option value="a4|portrait">A4 • Portrait</option>
              <option value="a4|landscape">A4 • Landscape</option>
              <option value="letter|portrait">US Letter • Portrait</option>
              <option value="letter|landscape">US Letter • Landscape</option>
            </select>
          </div>
          <div class="pdfx-preview-hint">Pages will be compiled in the order you select them.</div>
          <div class="pdfx-actions">
            <button class="pdfx-cancel">Cancel</button>
            <button class="pdfx-export">Export PDF</button>
          </div>
        </section>
      </div>
    </div>
  </div>`;

  function ensureModal() {
    if (!$('#pdfx-overlay')) {
      const wrap = document.createElement('div');
      wrap.innerHTML = modalHTML;
      document.body.appendChild(wrap.firstElementChild);
    }
  }

  function openModal() {
    ensureModal();
    $('#pdfx-overlay').hidden = false;
    buildList();
  }
  function closeModal() {
    const ov = $('#pdfx-overlay');
    if (ov) ov.hidden = true;
  }

  // --- 2) Build the selectable list from the left sidebar ---
  function readSidebar() {
    // Grab current visible sidebar links (avoid external)
    const links = $$('aside a[href^="/"]:not([href="#"])');
    // De-duplicate by pathname
    const seen = new Set();
    const items = [];
    links.forEach(a => {
      try {
        const url = new URL(a.getAttribute('href'), location.origin);
        if (seen.has(url.pathname)) return;
        seen.add(url.pathname);
        const title = a.textContent.trim() || url.pathname.split('/').filter(Boolean).pop();
        items.push({ title, path: url.pathname });
      } catch {}
    });
    return items;
  }

  let cachedItems = [];
  function buildList() {
    cachedItems = readSidebar();
    const list = $('.pdfx-list');
    if (!list) return;
    list.innerHTML = cachedItems.map((it, i) => `
      <label class="pdfx-row">
        <input type="checkbox" class="pdfx-item" data-path="${it.path}" data-title="${it.title.replace(/"/g,'&quot;')}" />
        <span class="pdfx-title">${it.title}</span>
        <span class="pdfx-path">${it.path}</span>
      </label>
    `).join('');
    updateCount();
  }

  function updateCount() {
    const n = $$('.pdfx-item:checked').length;
    $('.pdfx-count').textContent = `${n} article(s) selected`;
  }

  // --- 3) Hook contextual-menu option ---
  function onDocClick(e) {
    const a = e.target.closest('a[href="#export-pdf"]');
    if (a) {
      e.preventDefault();
      openModal();
    }
  }

  // --- 4) Filtering + select all ---
  function onModalEvents() {
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
          const t = row.querySelector('.pdfx-title').textContent.toLowerCase();
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
        try {
          await doExport();
        } catch (err) {
          alert('Export failed: ' + (err?.message || err));
        }
      }
    });
  }

  // --- 5) Fetch & compile pages, then export ---
  async function fetchArticle(pathname) {
    const res = await fetch(pathname, { credentials: 'same-origin' });
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const main = findArticle(doc).cloneNode(true);

    // Remove non-essential interactive UI
    main.querySelectorAll('button, [role="button"], .no-print').forEach(n => n.remove());

    return main;
  }

  async function doExport() {
    await loadHtml2Pdf();

    const selected = $$('.pdfx-item:checked').map(cb => ({
      title: cb.dataset.title,
      path: cb.dataset.path
    }));
    if (!selected.length) return alert('Select at least one article.');

    // Template & paper
    const [format, orientation] = ($('.pdfx-paper').value || 'a4|portrait').split('|');

    // Build offscreen wrapper with page breaks between articles
    const wrap = document.createElement('div');
    wrap.className = 'pdfx-wrap';
    for (let i = 0; i < selected.length; i++) {
      const { title, path } = selected[i];
      const section = document.createElement('section');
      section.className = 'pdfx-article';

      // Per-article cover/title
      const h = document.createElement('header');
      h.className = 'pdfx-article-header';
      h.innerHTML = `<h1 class="pdfx-article-title">${title}</h1><div class="pdfx-article-path">${location.origin}${path}</div>`;
      section.appendChild(h);

      const main = await fetchArticle(path);
      section.appendChild(main);

      wrap.appendChild(section);
      if (i < selected.length - 1) {
        const br = document.createElement('div');
        br.className = 'html2pdf__page-break';
        wrap.appendChild(br);
      }
    }

    const fname = `blockaid-docs_${slug(selected[0].title)}${selected.length>1?`-and-${selected.length-1}-more`:''}.pdf`;

    const opt = {
      margin: [10, 12, 14, 12],
      filename: fname,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF: { unit: 'mm', format: format, orientation: orientation },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    await window.html2pdf().set(opt).from(wrap).save();
    closeModal();
  }

  // --- 6) Boot ---
  function ready(fn){ (document.readyState==='complete'||document.readyState==='interactive') ? fn() : document.addEventListener('DOMContentLoaded', fn, {once:true}); }
  ready(() => {
    ensureModal();
    document.addEventListener('click', onDocClick);
    onModalEvents();
  });
})();
