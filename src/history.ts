// Account history: every ranked RR change and competitive match line we can get,
// persisted so it keeps growing, plus the aggregates the history page draws.
import { henrik } from './henrik.js';
import { cached, keepRows, keptRows } from './db.js';
import { playerPrefix, storedLine, type Line, type Seasonal, type Stored } from './data.js';
import { ratio, seg, type Region } from './lib.js';

export type RrPoint = {
  id: string; at: number; tier: number; before: number; rr: number; change: number; elo: number;
  season: string; map: string; prot: boolean; placement: boolean;
};
type RrApi = {
  match_id: string; tier: { id: number }; tier_before_update: { id: number } | null; rr: number; last_change: number; elo: number;
  date: string; season: { short: string } | null; map: { name: string } | null; was_derank_protected: boolean; is_placement_match: boolean;
};

const TTL = 600;
const PAGE = 500, MAX_PAGES = 6;

const toPoint = (h: RrApi): RrPoint => ({
  id: h.match_id, at: Date.parse(h.date), tier: h.tier?.id ?? 0, before: h.tier_before_update?.id ?? h.tier?.id ?? 0,
  rr: h.rr, change: h.last_change, elo: h.elo, season: h.season?.short ?? '', map: h.map?.name ?? '—',
  prot: !!h.was_derank_protected, placement: !!h.is_placement_match,
});

/** RR change per match id: keeps the profile's recent history and merges everything stored. */
export function rrByMatch(puuid: string, recent: unknown[]): Map<string, RrPoint> {
  const pts = (recent as RrApi[]).filter((h) => h?.match_id && h.date).map(toPoint);
  if (pts.length) keepRows('rr_history', puuid, pts);
  return new Map(keptRows<RrPoint>('rr_history', puuid).map((p) => [p.id, p]));
}

export async function loadHistory(region: Region, name: string, tag: string, puuid: string) {
  const key = playerPrefix(region, name, tag);
  const rr = cached(`${key}:rrstore`, TTL, async () => {
    const list = await henrik<RrApi[]>(`/valorant/v2/stored-mmr-history/${region}/pc/${seg(name)}/${seg(tag)}?size=500`);
    keepRows('rr_history', puuid, (list ?? []).map(toPoint));
    return list?.length ?? 0;
  });
  const keep = (list: Stored[] | null) =>
    keepRows('match_lines', puuid, (list ?? []).filter((s) => s.stats?.puuid === puuid).map((s) => ({ ...storedLine(s), at: Date.parse(s.meta.started_at) })));
  const page = (n: number) => henrik<Stored[]>(`/valorant/v1/stored-matches/${region}/${seg(name)}/${seg(tag)}?size=${PAGE}&page=${n}&mode=competitive`);
  // newest page often; older pages (full account history) once a day
  const lines = cached(`${key}:linesall`, TTL, async () => {
    const list = await page(1);
    keep(list);
    return list?.length ?? 0;
  });
  const older = lines.then((r) => (r.value ?? 0) < PAGE ? null : cached(`${key}:linesdeep`, 86400, async () => {
    let n = 0;
    for (let p = 2; p <= MAX_PAGES; p++) {
      const list = await page(p);
      keep(list);
      n += list?.length ?? 0;
      if ((list?.length ?? 0) < PAGE) break;
    }
    return n;
  }));
  const res = await Promise.allSettled([rr, lines, older]);
  return {
    rr: keptRows<RrPoint>('rr_history', puuid),
    lines: keptRows<Line>('match_lines', puuid),
    warn: res.some((r) => r.status === 'rejected' || !!r.value?.stale),
  };
}

// ---- aggregates (pure; all lists oldest first) -----------------------------

/** Brazil has no DST since 2019: a fixed −3 h gives local calendar fields via UTC getters. */
const local = (ms: number) => new Date(ms - 3 * 3600_000);
export const dayKey = (ms: number) => local(ms).toISOString().slice(0, 10);

export type Act = { short: string; end: number; endRr: number; peak: number; games: number; wins: number; board: number | null };
export function acts(seasonal: Seasonal[]): Act[] {
  return seasonal
    .filter((s) => s.games > 0 || (s.end_tier?.id ?? 0) >= 3)
    .map((s) => ({
      short: s.season.short, end: s.end_tier?.id ?? 0, endRr: s.end_rr ?? 0,
      peak: Math.max(s.act_rank?.id ?? 0, ...(s.act_wins ?? []).map((t) => t.id), 0),
      games: s.games, wins: s.wins, board: s.leaderboard_placement?.rank ?? null,
    }));
}

export type Roll = { at: number; kd: number; acs: number; hs: number };
export function rolling(lines: Line[]): { w: number; pts: Roll[] } {
  const w = Math.min(20, Math.max(5, Math.round(lines.length / 10)));
  const pts: Roll[] = [];
  for (let i = w - 1; i < lines.length; i++) {
    let k = 0, d = 0, sc = 0, r = 0, hs = 0, shots = 0;
    for (let j = i - w + 1; j <= i; j++) {
      const l = lines[j];
      k += l.k; d += l.d; sc += l.score; r += l.rounds; hs += l.hs; shots += l.hs + l.bs + l.ls;
    }
    pts.push({ at: lines[i].started, kd: ratio(k, d), acs: ratio(sc, r), hs: ratio(hs, shots) });
  }
  // keep hover targets and path size sane
  const step = Math.ceil(pts.length / 160);
  return { w, pts: step > 1 ? pts.filter((_, i) => i % step === 0 || i === pts.length - 1) : pts };
}

export type Month = { key: string; wins: number; losses: number; draws: number };
export function months(lines: Line[]): Month[] {
  const m = new Map<string, Month>();
  for (const l of lines) {
    const key = local(l.started).toISOString().slice(0, 7);
    const e = m.get(key) ?? { key, wins: 0, losses: 0, draws: 0 };
    if (l.win) e.wins++; else if (l.draw) e.draws++; else e.losses++;
    m.set(key, e);
  }
  const keys = [...m.keys()].sort();
  if (!keys.length) return [];
  // continuous axis: months without games show as empty slots
  const out: Month[] = [];
  let [y, mo] = keys[0].split('-').map(Number);
  const last = keys[keys.length - 1];
  for (;;) {
    const key = `${y}-${String(mo).padStart(2, '0')}`;
    out.push(m.get(key) ?? { key, wins: 0, losses: 0, draws: 0 });
    if (key >= last) break;
    if (++mo > 12) { mo = 1; y++; }
  }
  return out.slice(-18);
}

export type Bucket = { label: string; games: number; wins: number };
export function byWeekday(lines: Line[]): Bucket[] {
  const names = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const b = names.map((label) => ({ label, games: 0, wins: 0 }));
  for (const l of lines) { const x = b[local(l.started).getUTCDay()]; x.games++; if (l.win) x.wins++; }
  return [...b.slice(1), b[0]];
}
export function byHour(lines: Line[]): Bucket[] {
  const b = [
    { label: 'Madrugada · 0–6h', games: 0, wins: 0 }, { label: 'Manhã · 6–12h', games: 0, wins: 0 },
    { label: 'Tarde · 12–18h', games: 0, wins: 0 }, { label: 'Noite · 18–24h', games: 0, wins: 0 },
  ];
  for (const l of lines) { const x = b[Math.floor(local(l.started).getUTCHours() / 6)]; x.games++; if (l.win) x.wins++; }
  return b;
}

export function perDay(lines: Line[]) {
  const m = new Map<string, { games: number; wins: number }>();
  for (const l of lines) {
    const k = dayKey(l.started);
    const e = m.get(k) ?? { games: 0, wins: 0 };
    e.games++; if (l.win) e.wins++;
    m.set(k, e);
  }
  return m;
}

export function records(lines: Line[], rr: RrPoint[], actList: Act[]) {
  let streak = 0, best = 0, bestEnd = 0;
  for (const l of lines) {
    streak = l.win ? streak + 1 : 0;
    if (streak > best) { best = streak; bestEnd = l.started; }
  }
  const top = <T>(xs: T[], f: (x: T) => number) => xs.reduce<T | null>((a, x) => (a == null || f(x) > f(a) ? x : a), null);
  return {
    streak: best ? { n: best, at: bestEnd } : null,
    gain: top(rr.filter((p) => !p.placement), (p) => p.change),
    acs: top(lines, (l) => ratio(l.score, l.rounds)),
    kills: top(lines, (l) => l.k),
    act: top(actList, (a) => a.games),
  };
}
