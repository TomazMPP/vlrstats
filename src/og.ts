// Share images (Open Graph, 1200×630 PNG) for Discord, WhatsApp, X: drawn as
// SVG and rasterised with resvg using the bundled Inter. Remote art (player
// cards, rank icons, maps) is fetched once and embedded as data URIs, since
// resvg does not load URLs. Rendered PNGs are kept in memory.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { fmt, tierName } from './lib.js';

// absolute paths; checked at boot so a missing font fails loudly, not as blank text
const fontFiles = ['400', '600', '700'].map((w) => fileURLToPath(new URL('../assets/fonts/Inter-' + w + '.ttf', import.meta.url)));
for (const f of fontFiles) if (!existsSync(f)) throw new Error('missing font ' + f);

export const W = 1200, H = 630;
const C = {
  bg: '#1b1a18', surface: '#252422', sunken: '#151413', line: 'rgba(239,238,236,0.10)',
  fg: '#efeeec', fg2: '#c6c4c0', fg3: '#9f9d98', down: '#e38a76',
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// ---- remote images -----------------------------------------------------------

const imgs = new Map<string, Promise<string | null>>();
/** A media.valorant-api.com image as a data URI (null if it can't be fetched). */
export function dataUri(url: string | null | undefined): Promise<string | null> {
  if (!url || !url.startsWith('https://media.valorant-api.com/')) return Promise.resolve(null);
  let p = imgs.get(url);
  if (!p) {
    p = fetch(url, { signal: AbortSignal.timeout(5000) })
      .then(async (r) => {
        if (!r.ok || !(r.headers.get('content-type') ?? '').startsWith('image/')) return null;
        const b = Buffer.from(await r.arrayBuffer());
        return b.length > 600_000 ? null : `data:${r.headers.get('content-type')};base64,${b.toString('base64')}`;
      })
      .catch(() => null);
    p.then((v) => { if (!v) imgs.delete(url); });
    if (imgs.size > 400) imgs.delete(imgs.keys().next().value!);
    imgs.set(url, p);
  }
  return p;
}

// ---- drawing helpers ------------------------------------------------------------

type TextOpt = { w?: number; c?: string; a?: 'start' | 'middle' | 'end'; ls?: number };
export const text = (x: number, y: number, size: number, s: string, o: TextOpt = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${o.w ?? 400}" fill="${o.c ?? C.fg}" text-anchor="${o.a ?? 'start'}"${o.ls ? ` letter-spacing="${o.ls}"` : ''}>${esc(s)}</text>`;

let clipN = 0;
/** An image clipped to a rounded box; a hatched placeholder when missing. */
export const pic = (href: string | null, x: number, y: number, w: number, h: number, r: number, fit: 'slice' | 'meet' = 'slice') => {
  if (!href) return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${C.surface}" stroke="${C.line}"/>`;
  const id = `c${++clipN}`;
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>`
    + `<image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid ${fit}" clip-path="url(#${id})"/>`
    + (fit === 'slice' && r > 0 ? `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="${r}" fill="none" stroke="${C.line}"/>` : '');
};

/** Big value over a small label. */
export const stat = (x: number, y: number, value: string, label: string) =>
  text(x, y, 46, value, { w: 700, ls: -1 }) + text(x, y + 34, 21, label, { c: C.fg3 });

const LOGO = (x: number, y: number) => {
  const bars = [[1, 3, 14], [4.85, 7, 10], [8.7, 11, 6], [12.55, 7, 10], [16.4, 3, 14]]
    .map(([bx, by, bh]) => `<rect x="${bx}" y="${by}" width="2.6" height="${bh}" rx="1.3"/>`).join('');
  return `<rect x="${x}" y="${y}" width="40" height="40" rx="10" fill="${C.fg}"/>`
    + `<g transform="translate(${x + 8} ${y + 8}) scale(1.2)" fill="${C.bg}">${bars}</g>`;
};

/** Page frame: background, dot grid, brand in the corner. */
function frame(body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter">
<defs><pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.1" fill="rgba(239,238,236,0.07)"/></pattern>
<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.bg}" stop-opacity="0"/><stop offset="1" stop-color="${C.bg}"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="${C.bg}"/><rect width="${W}" height="${H}" fill="url(#dots)"/>
${body}
${LOGO(W - 72 - 40 - 150, H - 72 - 34)}${text(W - 72, H - 72 - 6, 26, 'vlrstats.lol', { w: 600, a: 'end', ls: -0.4 })}
</svg>`;
}

export function png(svg: string): Buffer {
  const r = new Resvg(frame(svg), {
    font: { fontFiles, defaultFontFamily: 'Inter', loadSystemFonts: false },
    fitTo: { mode: 'width', value: W },
  });
  return Buffer.from(r.render().asPng());
}

// Rendered PNGs live in memory only (~100 KB each): cheap to redraw, not worth the DB.
const pngs = new Map<string, { at: number; buf: Promise<Buffer> }>();
export function cachedPng(key: string, ttlSec: number, draw: () => Promise<string>): Promise<Buffer> {
  const hit = pngs.get(key);
  if (hit && Date.now() - hit.at < ttlSec * 1000) return hit.buf;
  const buf = draw().then(png);
  buf.catch(() => pngs.delete(key));
  pngs.delete(key);
  if (pngs.size >= 150) pngs.delete(pngs.keys().next().value!);
  pngs.set(key, { at: Date.now(), buf });
  return buf;
}

// ---- cards -------------------------------------------------------------------------

export type OgPlayer = { name: string; tag: string; card: string | null; region: string };
export type OgRank = { tier: number; rr: number; peak: number; icon: string | null };

/** Name block: card art + Riot ID + subtitle. */
async function head(p: OgPlayer, cardUrl: string | null, sub: string) {
  const card = await dataUri(cardUrl);
  const name = p.name.length > 14 ? p.name.slice(0, 13) + '…' : p.name;
  return pic(card, 72, 72, 132, 132, 26)
    + text(232, 140, 58, name, { w: 700, ls: -1.6 })
    + text(232, 186, 28, `#${p.tag} · ${sub}`, { c: C.fg3 });
}

async function rankBlock(r: OgRank, x: number, y: number, label = 'Rank atual') {
  const icon = await dataUri(r.icon);
  const ranked = r.tier >= 3;
  return text(x, y, 21, label.toUpperCase(), { c: C.fg3, w: 600, ls: 1.2 })
    + (ranked ? pic(icon, x, y + 22, 92, 92, 0, 'meet') : '')
    + text(ranked ? x + 112 : x, y + 72, 44, tierName(r.tier), { w: 700, ls: -1 })
    + text(ranked ? x + 112 : x, y + 108, 24, ranked ? `${r.rr} RR · pico ${tierName(r.peak)}` : 'sem partidas ranqueadas no ato', { c: C.fg2 });
}

export type OgTotals = { games: number; winRate: number; kd: number; acs: number; hsRate: number };

export async function profileSvg(p: OgPlayer, cardUrl: string | null, r: OgRank, t: OgTotals | null) {
  let s = await head(p, cardUrl, `${p.region.toUpperCase()} · Competitivo`);
  s += await rankBlock(r, 72, 268);
  s += `<line x1="72" y1="418" x2="${W - 72}" y2="418" stroke="${C.line}"/>`;
  if (t && t.games) {
    const cols = [
      [fmt.pct(t.winRate), 'vitórias'], [fmt.two(t.kd), 'K/D'], [fmt.int(t.acs), 'ACS'], [fmt.pct(t.hsRate), 'headshot'],
    ];
    s += cols.map(([v, l], i) => stat(72 + i * 190, 486, v, l)).join('');
    s += text(72, 576, 20, `últimas ${t.games} partidas competitivas`, { c: C.fg3 });
  } else {
    s += text(72, 492, 26, 'Sem partidas competitivas recentes', { c: C.fg2 });
  }
  return s;
}

export type OgAct = {
  short: string; games: number; wins: number; losses: number; rrNet: number | null; streak: number;
  kd: number; acs: number; hsRate: number;
  agent: { name: string; icon: string | null; games: number } | null;
  map: { name: string; winRate: number; games: number } | null;
};

export async function recapSvg(p: OgPlayer, cardUrl: string | null, r: OgRank, a: OgAct) {
  const act = a.short.toUpperCase();
  let s = await head(p, cardUrl, `Resumo do ato ${act}`);
  s += await rankBlock(r, 72, 268, `Rank no ato ${act}`.trim());
  // right column: the act in numbers
  const x = 660;
  s += text(x, 268, 21, 'O ATO', { c: C.fg3, w: 600, ls: 1.2 });
  s += text(x, 330, 50, `${a.wins}V ${a.losses}D`, { w: 700, ls: -1.2 });
  s += text(x, 366, 24, `${a.games} partidas · ${fmt.pct(a.games ? a.wins / a.games : 0)} de vitória`, { c: C.fg2 });
  if (a.rrNet != null) s += text(W - 72, 330, 50, `${fmt.signed(a.rrNet)} RR`, { w: 700, a: 'end', ls: -1.2, c: a.rrNet < 0 ? C.down : C.fg });
  s += `<line x1="72" y1="418" x2="${W - 72}" y2="418" stroke="${C.line}"/>`;
  s += stat(72, 486, fmt.two(a.kd), 'K/D');
  s += stat(232, 486, fmt.int(a.acs), 'ACS');
  s += stat(392, 486, fmt.pct(a.hsRate), 'headshot');
  s += stat(572, 486, String(a.streak), 'vitórias seguidas');
  // agent + map line
  const parts: string[] = [];
  if (a.agent) parts.push(`${a.agent.name} (${a.agent.games})`);
  if (a.map) parts.push(`melhor mapa: ${a.map.name} ${fmt.pct(a.map.winRate)}`);
  if (a.agent) {
    const icon = await dataUri(a.agent.icon);
    s += pic(icon, 72, 548, 40, 40, 10);
  }
  if (parts.length) s += text(a.agent ? 126 : 72, 577, 22, parts.join(' · '), { c: C.fg2 });
  return s;
}

export type OgMatch = {
  map: string; mapIcon: string | null; mode: string; when: string; mine: number; theirs: number;
  result: 'Vitória' | 'Derrota' | 'Empate' | null;
  /** Deathmatch placement; replaces the team score. */
  place?: { pos: number; of: number } | null;
  who: { name: string; tag: string; agent: string; agentIcon: string | null; k: number; d: number; a: number; ps: number | null; mvp: boolean } | null;
};

export async function matchSvg(m: OgMatch) {
  const banner = await dataUri(m.mapIcon);
  let s = banner
    ? pic(banner, 0, 0, W, 263, 0) + `<rect width="${W}" height="264" fill="url(#fade)"/><rect width="${W}" height="263" fill="${C.bg}" opacity="0.45"/>`
    : '';
  s += text(72, 200, 64, m.map, { w: 700, ls: -1.8 });
  s += text(72, 244, 26, `${m.mode} · ${m.when}`, { c: C.fg2 });
  if (m.place) {
    s += text(72, 386, 108, `${m.place.pos}º`, { w: 700, ls: -3 });
    s += text(72, 432, 26, `de ${m.place.of} jogadores`, { w: 600, c: C.fg2 });
  } else {
    s += text(72, 386, 108, `${m.mine}`, { w: 700, ls: -3 });
    const w1 = String(m.mine).length * 64 + 28;
    s += text(72 + w1, 386, 108, '–', { w: 400, c: C.fg3 });
    s += text(72 + w1 + 92, 386, 108, `${m.theirs}`, { w: 700, ls: -3, c: C.fg2 });
  }
  if (m.result && !m.place) s += text(72, 432, 26, m.result, { w: 600, c: m.result === 'Derrota' ? C.down : C.fg });
  if (m.who) {
    const icon = await dataUri(m.who.agentIcon);
    const x = 660;
    s += pic(icon, x, 300, 72, 72, 16);
    s += text(x + 92, 332, 32, m.who.name.length > 14 ? m.who.name.slice(0, 13) + '…' : m.who.name, { w: 700, ls: -0.6 });
    s += text(x + 92, 366, 22, `${m.who.agent}${m.who.mvp ? ' · MVP da partida' : ''}`, { c: C.fg3 });
    s += stat(x, 450, `${m.who.k}/${m.who.d}/${m.who.a}`, 'K / D / A');
    if (m.who.ps != null) s += stat(x + 250, 450, fmt.int(m.who.ps), 'Performance Score');
  }
  return s;
}

export const genericSvg = () =>
  text(72, 250, 76, 'Suas partidas de Valorant,', { w: 700, ls: -2.4 })
  + text(72, 340, 76, 'analisadas.', { w: 700, ls: -2.4 })
  + text(72, 410, 30, 'Rank, histórico, Performance Score e duo, por Riot ID.', { c: C.fg2 });
