(function() {
  if (window.__PDFX_SETUP) return;
  window.__PDFX_SETUP = true;

  // --- Helpers ---
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const slugify = (s = '') => s.trim().toLowerCase()
    .replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  function findMain(root = document) {
    return root.querySelector('main article, main [data-content], main') || root.body || root;
  }

  function loadHtml2Pdf() {
    return new Promise((resolve, reject) => {
      if (window.html2pdf) return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load html2pdf'));
      document.head.appendChild(s);
    });
  }

  // --- Modal Creation ---
  const MODAL_HTML = `
    <style id="pdfx-styles">
      /* overlay & modal styles omitted for brevity... same as earlier */
    </style>
    <div id="pdfx-overlay" hidden>
      <!-- modal structure as before (search, list, export buttons) -->
    </div>`;

  function ensureModal() {
    if (!$('#pdfx-overlay')) {
      const div = document.createElement('div');
      div.innerHTML = MODAL_HTML;
      document.body.appendChild(div.firstElementChild);
      document.body.appendChild(div.lastElementChild);
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

  // --- Sidebar List Building ---
  function readSidebar() {
    const links = $$('aside a[href^="/"]:not([href="#"])');
    const seen = new Set();
    return links
      .map(a => {
        try {
          const u = new URL(a.href);
          return { title: a.textContent.trim() || u.pathname.split('/').pop(), path: u.pathname };
        } catch {
          return null;
        }
      })
      .filter(x => x && !seen.has(x.path) && seen.add(x.path));
  }

  let cached = [];
  function buildList() {
    cached = readSidebar();
    const list = $('.pdfx-list');
    if (!list) return;
    list.innerHTML = cached.map(it => `
      <label class="pdfx-row">
        <input type="checkbox" class="pdfx-item" data-path="${it.path}" data-title="${it.title.replace(/"/g,'&quot;')}" />
        <span class="pdfx-title">${it.title}</span>
        <span class="pdfx-path">${it.path}</span>
      </label>
    `).join('');
    updateCount();
  }

  function updateCount() {
    const cnt = $$('.pdfx-item:checked').length;
    const el = $('.pdfx-count');
    if (el) el.textContent = `${cnt} article(s) selected`;
  }

  // --- Export Flow ---
  async function fetchArticle(path) {
    const txt = await fetch(path, { credentials: 'same-origin' }).then(r => r.text());
    const dom = new DOMParser().parseFromString(txt, 'text/html');
    const content = findMain(dom).cloneNode(true);
    content.querySelectorAll('button, [role="button"], .no-print').forEach(n => n.remove());
    return content;
  }

  async function doExport() {
    await loadHtml2Pdf();
    const items = $$('.pdfx-item:checked').map(cb => ({
      title: cb.dataset.title, path: cb.dataset.path
    }));
    if (!items.length) return alert('Select at least one article.');
    const [format, orient] = ($('.pdfx-paper').value || 'a4|portrait').split('|');
    const quality = parseFloat($('.pdfx-quality').value || '0.98');
    const wrapper = document.createElement('div');

    for (let i = 0; i < items.length; i++) {
      const { title, path } = items[i];
      const sec = document.createElement('section');
      sec.innerHTML = `<h1>${title}</h1><div>${location.origin}${path}</div>`;
      sec.appendChild(await fetchArticle(path));
      wrapper.appendChild(sec);
      if (i < items.length - 1) {
        const br = document.createElement('div');
        br.className = 'html2pdf__page-break';
        wrapper.appendChild(br);
      }
    }

    const fname = `docs_${slugify(items[0].title)}${items.length > 1 ? `-plus-${items.length-1}-more` : ''}.pdf`;
    const opts = {
      filename: fname,
      margin: [10, 12, 14, 12],
      image: { type: 'jpeg', quality },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF: { unit: 'mm', format, orientation },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    await window.html2pdf().set(opts).from(wrapper).save();
    closeModal();
  }

  // --- Trigger via URL ---
  function checkTrigger() {
    const u = new URL(location.href);
    if (u.hash === '#export-pdf' || u.searchParams.get('export') === 'pdf') {
      history.replaceState({}, '', location.pathname + (u.searchParams.get('export') ? '' : u.search));
      openModal();
    }
  }

  // --- Modal Events ---
  function setupModalEvents() {
    const ov = $('#pdfx-overlay');
    if (!ov) return;
    ov.addEventListener('click', e => {
      if (e.target === ov || e.target.matches('.pdfx-close, .pdfx-cancel')) closeModal();
    });
    ov.addEventListener('input', e => {
      if (e.target.matches('.pdfx-search')) {
        const q = e.target.value.toLowerCase();
        $$('.pdfx-row').forEach(r => {
          const t = r.querySelector('.pdfx-title').textContent.toLowerCase();
          const p = r.querySelector('.pdfx-path').textContent.toLowerCase();
          r.hidden = !(t.includes(q) || p.includes(q));
        });
      }
      if (e.target.matches('#pdfx-select-all')) {
        $$('.pdfx-item').forEach(cb => cb.checked = e.target.checked);
        updateCount();
      }
      if (e.target.matches('.pdfx-item')) updateCount();
    });
    ov.addEventListener('click', e => {
      if (e.target.matches('.pdfx-export')) doExport();
    });
  }

  // --- Initialization ---
  document.addEventListener('DOMContentLoaded', () => {
    ensureModal();
    setupModalEvents();
    checkTrigger();
    window.addEventListener('hashchange', checkTrigger);
    window.addEventListener('popstate', checkTrigger);
    // Also rebuild list on SPA nav
    const mo = new MutationObserver(() => $('#pdfx-overlay') && !$('#pdfx-overlay').hidden && buildList());
    mo.observe(document.body, { childList: true, subtree: true });
  });
})();
