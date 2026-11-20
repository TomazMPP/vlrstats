// Partial navigation: links with data-swap="<selector>" fetch the next page and
// replace only that region, so the rest of the page (and the scroll) stays put.
// Anything unexpected falls back to a normal navigation.
(() => {
  const cache = new Map(); // url -> { at, p: Promise<string> }
  const TTL = 30_000;

  const get = (url) => {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < TTL) return hit.p;
    const p = fetch(url, { headers: { 'x-swap': '1' } }).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.text();
    });
    p.catch(() => cache.delete(url));
    cache.set(url, { at: Date.now(), p });
    return p;
  };

  let used = null; // region swapped in this document; popstate only lands on entries of this page

  const swap = async (url, sel, push) => {
    used = sel;
    const region = document.querySelector(sel);
    if (!region) return location.assign(url);
    region.setAttribute('aria-busy', 'true');
    try {
      const doc = new DOMParser().parseFromString(await get(url), 'text/html');
      const next = doc.querySelector(sel);
      if (!next) throw new Error('missing region');
      next.querySelectorAll('.in').forEach((el) => el.classList.remove('in'));
      region.replaceWith(next);
      document.title = doc.title;
      if (push) history.pushState({ swap: sel }, '', url);
    } catch {
      location.assign(url);
    } finally {
      region.removeAttribute('aria-busy');
    }
  };

  const link = (e) => e.target.closest?.('a[data-swap]');

  document.addEventListener('click', (e) => {
    const a = link(e);
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (a.classList.contains('tab')) {
      a.parentElement.querySelectorAll('.tab').forEach((t) => { t.classList.toggle('on', t === a); t.toggleAttribute('aria-current', t === a); });
    }
    swap(a.href, a.dataset.swap, true);
  });

  const warm = (e) => { const a = link(e); if (a) get(a.href).catch(() => {}); };
  document.addEventListener('pointerover', warm, { passive: true });
  document.addEventListener('focusin', warm);
  document.addEventListener('touchstart', warm, { passive: true });

  addEventListener('popstate', (e) => {
    const sel = e.state?.swap ?? used;
    if (sel) swap(location.href, sel, false);
    else location.reload();
  });
})();
