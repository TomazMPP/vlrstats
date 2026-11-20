// Skeleton screens shaped like the page that is loading. Shown while a full
// navigation is in flight (search, profile, stats, match links) and inside
// swapped regions when the fetch takes longer than a beat.
window.SK = (() => {
  const b = (w, h, more = '') => `<span class="sk" style="width:${w};height:${h}px;${more}"></span>`;
  const r = (w, h, rad) => b(w, h, `border-radius:${rad}px`);
  const pick = (a, i) => a[i % a.length];
  const rows = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');
  const W1 = ['46%', '38%', '52%', '42%', '34%', '48%', '40%', '44%'];
  const W2 = ['62%', '70%', '56%', '66%', '60%', '72%', '58%', '64%'];

  const sh = (w, right) => `<div class="sh">${b(w, 12)}${right}</div>`;

  // ---- profile
  const kpi = (i) => `<div class="card kpi" style="gap:10px">${b(pick(['52px', '44px', '60px'], i), 20)}${b(pick(['70%', '54%', '62%'], i), 9)}</div>`;
  const mrow = (i) => `<div class="mrow sk-row">${r('24px', 24, 7)}<span class="hrow" style="gap:12px">${r('32px', 32, 8)}<span class="col" style="gap:7px;flex:1">${b(pick(W1, i), 11)}${b(pick(W2, i), 9)}</span></span>`
    + ['34px', '58px', '28px', '30px', '28px'].map((w) => b(w, 11, 'margin-left:auto')).join('') + '<span></span></div>';
  const profileMain = () =>
    `<section>${sh('96px', b('132px', 10))}<div class="grid3">${rows(6, kpi)}</div></section>`
    + `<section>${sh('70px', r('300px', 36, 12))}<div class="card scroll"><div style="min-width:680px">${rows(8, mrow)}</div></div></section>`;
  const kv = (i) => `<div class="kv">${b(pick(['56px', '72px', '88px'], i), 10)}${b(pick(['96px', '84px', '52px'], i), 10)}</div>`;
  const profile = () => `<div class="prof">
    <aside class="side">
      <div style="display:flex;flex-direction:column;gap:14px">${r('72px', 72, 16)}
        <div class="col" style="gap:10px">${b('68%', 24)}${b('86%', 10)}</div>
        <div class="actions">${r('104px', 36, 12)}${r('116px', 36, 12)}</div></div>
      <div class="card pad" style="display:flex;flex-direction:column;gap:14px">
        <div class="hrow" style="gap:12px">${r('44px', 44, 12)}<div class="col" style="gap:8px;flex:1">${b('46%', 9)}${b('68%', 12)}</div>${b('34px', 22)}</div>
        ${r('100%', 6, 99)}<div>${rows(3, kv)}</div></div>
      <div class="card pad" style="display:flex;flex-direction:column;gap:12px">${b('42%', 12)}${r('100%', 64, 10)}</div>
    </aside>
    <div class="main"><div>${r('284px', 36, 12)}</div>${profileMain()}</div></div>`;

  // ---- stats
  const trow = (i) => `<div class="mrow sk-row" style="grid-template-columns:minmax(0,1.6fr) repeat(6,minmax(0,1fr))"><span class="hrow">${r('32px', 32, 8)}${b(pick(W1, i), 11)}</span>`
    + rows(6, () => b('32px', 11, 'margin-left:auto')) + '</div>';
  const mapline = () => `<div class="hrow" style="gap:14px;padding:12px 0">${b('64px', 11)}${b('auto', 8, 'flex:1 1 auto;border-radius:99px')}${b('34px', 11)}</div>`;
  const statsMain = () =>
    `<section>${sh('72px', b('64px', 10))}<div class="card scroll"><div style="min-width:640px">${rows(5, trow)}</div></div></section>
    <div class="two"><section>${sh('56px', b('80px', 10))}<div class="card" style="padding:8px 18px">${rows(6, mapline)}</div></section>
    <section>${sh('76px', b('72px', 10))}<div class="card pad" style="display:flex;flex-direction:column;gap:14px">${r('100%', 14, 99)}${b('80%', 10)}</div></section></div>`;
  const stats = () => `<div class="stack"><div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap">
    <div class="col" style="gap:10px">${b('180px', 26)}${b('220px', 10)}</div><div class="hrow" style="gap:8px;flex-wrap:wrap">${r('284px', 36, 12)}${r('130px', 36, 12)}</div></div>${statsMain()}</div>`;

  // ---- match
  const prow = (i) => `<div class="mrow sk-row" style="grid-template-columns:minmax(0,1.8fr) repeat(8,minmax(0,.6fr))"><span class="hrow">${r('32px', 32, 8)}<span class="col" style="gap:7px;flex:1">${b(pick(W1, i), 11)}${b('36%', 9)}</span></span>`
    + rows(8, () => b('24px', 11, 'margin-left:auto')) + '</div>';
  const team = () => `<section>${sh('130px', r('64px', 22, 99))}<div class="card scroll"><div style="min-width:680px">${rows(5, prow)}</div></div></section>`;
  const match = () => `<div class="stack">
    <section class="card mhero"><div class="hrow" style="gap:16px">${r('96px', 64, 12)}<div class="col" style="gap:10px">${b('140px', 26)}${b('240px', 10)}</div></div>
      <div class="score">${b('34px', 30)}${b('34px', 30)}</div></section>
    <section>${sh('64px', b('120px', 10))}<div class="card pad">${r('100%', 44, 10)}</div></section>${team()}${team()}</div>`;

  const LOGO = '<span class="mark" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><rect x="1" y="3" width="2.6" height="14" rx="1.3"/><rect x="4.85" y="7" width="2.6" height="10" rx="1.3"/><rect x="8.7" y="11" width="2.6" height="6" rx="1.3"/><rect x="12.55" y="7" width="2.6" height="10" rx="1.3"/><rect x="16.4" y="3" width="2.6" height="14" rx="1.3"/></svg></span>';
  const page = (kind) => {
    const toggle = document.querySelector('[data-theme-toggle]')?.outerHTML ?? '';
    const body = kind === 'stats' ? stats() : kind === 'match' ? match() : profile();
    return `<div class="wrap page" data-sk role="status" aria-label="Carregando">
      <header class="top"><a class="brand" href="/">${LOGO}vlrstats</a><div class="hrow" style="gap:8px">${r('200px', 36, 12)}${toggle}</div></header>${body}</div>`;
  };

  /** Which skeleton fits a URL (null = none). */
  const kindOf = (url) => {
    const u = new URL(url, location.href);
    if (u.origin !== location.origin) return null;
    if (u.pathname === '/search') return 'profile';
    if (/^\/m\/[^/]+\/[^/]+\/?$/.test(u.pathname)) return 'match';
    if (/^\/p\/[^/]+\/[^/]+\/[^/]+\/stats\/?$/.test(u.pathname)) return 'stats';
    if (/^\/p\/[^/]+\/[^/]+\/[^/]+(\/refresh)?\/?$/.test(u.pathname)) return 'profile';
    return null;
  };

  let shown = null;
  const show = (kind) => {
    if (shown) return;
    const hide = [...document.body.children].filter((el) => !el.classList.contains('dots') && el.tagName !== 'SCRIPT');
    hide.forEach((el) => { el.hidden = true; });
    const tpl = document.createElement('template');
    tpl.innerHTML = page(kind);
    const node = tpl.content.firstElementChild;
    document.body.append(node);
    scrollTo(0, 0);
    shown = { node, hide };
  };
  const restore = () => {
    if (!shown) return;
    shown.node.remove();
    shown.hide.forEach((el) => { el.hidden = false; });
    shown = null;
  };

  // Full navigations: show the skeleton a beat after leaving, so fast/cached pages never flash it.
  let timer = 0;
  const leave = (url) => {
    const kind = kindOf(url);
    if (!kind) return;
    clearTimeout(timer);
    timer = setTimeout(() => show(kind), 90);
  };
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.('a[href]');
    if (!a || a.target || a.hasAttribute('download') || a.dataset.swap) return;
    const u = new URL(a.href, location.href);
    if (u.pathname === location.pathname && u.search === location.search) return; // same page / hash link
    leave(u.href);
  });
  document.addEventListener('submit', (e) => {
    const f = e.target;
    if (e.defaultPrevented || !(f instanceof HTMLFormElement)) return;
    if ((f.method || 'get').toLowerCase() === 'get' && !f.checkValidity()) return;
    leave(f.action);
  });
  // Back/forward cache restores the page as we left it: put the real content back.
  addEventListener('pageshow', (e) => { if (e.persisted) { clearTimeout(timer); restore(); } });

  /** Fill a swapped region with skeletons in place of its data, keeping headings and tabs. */
  const fill = (el, sel, url) => {
    if (sel === '#pmain') {
      const list = el.querySelector('#partidas .card');
      const more = new URL(url, location.href).searchParams.has('n');
      if (more && list?.firstElementChild) { // "load more": rows grow at the bottom
        list.firstElementChild.insertAdjacentHTML('beforeend', rows(10, mrow));
        el.querySelector('#partidas .btn')?.closest('div')?.remove();
        return true;
      }
      const perf = el.querySelector('#partidas')?.previousElementSibling;
      if (perf) perf.lastElementChild.outerHTML = `<div class="grid3">${rows(6, kpi)}</div>`;
      if (list) list.innerHTML = `<div style="min-width:680px">${rows(8, mrow)}</div>`;
      el.querySelector('#partidas ~ section')?.remove();
      el.querySelector('#partidas .btn')?.closest('div')?.remove();
      return !!(perf || list);
    }
    if (sel === '#smain' && el.firstElementChild) {
      while (el.firstElementChild.nextSibling) el.firstElementChild.nextSibling.remove();
      el.firstElementChild.insertAdjacentHTML('afterend', statsMain());
      return true;
    }
    return false;
  };
  return { fill };
})();

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
    // slow fetch: swap the region's body (below its tabs/header) for a skeleton
    let skel = false;
    const t = setTimeout(() => {
      if (!window.SK?.fill(region, sel, url)) return;
      region.removeAttribute('aria-busy');
      skel = true;
    }, 140);
    try {
      const doc = new DOMParser().parseFromString(await get(url), 'text/html');
      clearTimeout(t);
      const next = doc.querySelector(sel);
      if (!next) throw new Error('missing region');
      next.querySelectorAll('.in').forEach((el) => el.classList.remove('in'));
      if (skel) [...next.children].slice(1).forEach((el) => el.classList.add('sk-reveal'));
      region.replaceWith(next);
      document.title = doc.title;
      if (push) history.pushState({ swap: sel }, '', url);
    } catch {
      location.assign(url);
    } finally {
      clearTimeout(t);
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
