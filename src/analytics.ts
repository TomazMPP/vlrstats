// First-party analytics: one row per page view in SQLite. No cookies, no raw IPs:
// a visitor is a salted hash of IP + user agent that rotates every day.
import { createHash, randomBytes } from 'node:crypto';
import type { Context, Next } from 'hono';
import { logHit, pruneHits, query } from './db.js';

const BOT = /bot|crawl|spider|slurp|curl|wget|python|httpx|go-http|java\/|headless|preview|facebookexternalhit|monitor|uptime|lighthouse|scan/i;

query('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
const salt = (() => {
  const row = query<{ v: string }>("SELECT v FROM meta WHERE k = 'salt'")[0];
  if (row) return row.v;
  const v = randomBytes(24).toString('hex');
  query("INSERT INTO meta (k, v) VALUES ('salt', ?)", v);
  return v;
})();

pruneHits(180);
setInterval(() => pruneHits(180), 86400_000).unref();

/** Which page a path is, and the player it is about. */
function classify(method: string, path: string, c: Context) {
  if (method === 'POST') {
    const m = /^\/p\/([^/]+)\/([^/]+)\/([^/]+)\/refresh$/.exec(path);
    return m ? { kind: 'refresh', region: m[1], player: dec(m[2]) + '#' + dec(m[3]) } : null;
  }
  if (path === '/') return { kind: 'home', region: null, player: null };
  if (path === '/search') return { kind: 'search', region: null, player: (c.req.query('riotid') ?? '').trim().slice(0, 40) || null };
  const p = /^\/p\/([^/]+)\/([^/]+)\/([^/]+)(\/stats|\/history|\/recap)?\/?$/.exec(path);
  if (p) return { kind: p[4] ? p[4].slice(1) : 'profile', region: p[1], player: dec(p[2]) + '#' + dec(p[3]) };
  if (/^\/m\/[^/]+\/[^/]+\/?$/.test(path)) return { kind: 'match', region: path.split('/')[2], player: null };
  const og = /^\/og\/(p|r|m)\/([^/]+)\/([^/]+)(?:\/([^/]+))?$/.exec(path);
  if (og) return { kind: 'og', region: og[2], player: og[1] === 'm' ? null : dec(og[3]) + '#' + dec(og[4] ?? '') };
  if (path === '/compare') return { kind: 'compare', region: null, player: (c.req.query('a') ?? '').trim().slice(0, 40) || null };
  return null;
}
const dec = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

export async function track(c: Context, next: Next) {
  const t0 = performance.now();
  await next();
  try {
    const path = new URL(c.req.url).pathname;
    const hit = classify(c.req.method, path, c);
    const ua = c.req.header('user-agent') ?? '';
    if (!hit || !ua || BOT.test(ua)) return;
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-real-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
    const today = new Date().toISOString().slice(0, 10);
    const visitor = createHash('sha256').update(`${salt}|${today}|${ip}|${ua}`).digest('hex').slice(0, 16);
    let ref: string | null = null;
    try {
      const r = c.req.header('referer');
      if (r) { const h = new URL(r).hostname.replace(/^www\./, ''); if (h !== new URL(c.req.url).hostname && h !== 'vlrstats.lol') ref = h; }
    } catch { /* bad referer */ }
    logHit({
      kind: c.req.header('x-swap') ? `${hit.kind}·aba` : hit.kind, path, status: c.res.status, visitor,
      country: c.req.header('cf-ipcountry') ?? null, ref, player: hit.player, region: hit.region, ms: Math.round(performance.now() - t0),
    });
  } catch (e) {
    console.error('[analytics]', e);
  }
}

// ---- reads for the dashboard -------------------------------------------------

const DAY = 86400_000;
/** São Paulo calendar day of a ms timestamp, in SQL. */
const LOCAL_DAY = "date((at - 10800000) / 1000, 'unixepoch')";

const PROFILE = "('profile','stats','history','profile·aba','stats·aba')";
const DEEP = "('stats','history','match','compare','stats·aba')";

/** Visitors (per day, as the hash rotates daily) reaching each step. */
function funnel(since: number) {
  return query<{ visitors: number; searched: number; profile: number; deep: number; searchToProfile: number; profileToDeep: number }>(
    `SELECT COUNT(*) visitors, SUM(s > 0) searched, SUM(p > 0) profile, SUM(d > 0) deep,
            SUM(s > 0 AND p > 0) searchToProfile, SUM(p > 0 AND d > 0) profileToDeep
     FROM (SELECT visitor,
                  SUM(kind = 'search') s,
                  SUM(kind IN ('profile','profile·aba') AND status = 200) p,
                  SUM(kind IN ${DEEP} AND status = 200) d
           FROM hits WHERE at >= ? GROUP BY visitor, ${LOCAL_DAY})`, since)[0];
}

/** Of the players viewed on a day, how many were viewed again the next day / within 7 days. */
function retention(since: number) {
  const today = Math.floor((Date.now() - 10800000) / DAY);
  return query<{ base1: number; d1: number; base7: number; d7: number }>(
    `WITH pd AS (SELECT DISTINCT lower(player) pl, CAST((at - 10800000) / 86400000 AS INT) day
                FROM hits WHERE at >= ? AND kind IN ${PROFILE} AND status = 200 AND player IS NOT NULL)
     SELECT SUM(a.day <= ${today - 1}) base1,
            SUM(a.day <= ${today - 1} AND EXISTS (SELECT 1 FROM pd b WHERE b.pl = a.pl AND b.day = a.day + 1)) d1,
            SUM(a.day <= ${today - 7}) base7,
            SUM(a.day <= ${today - 7} AND EXISTS (SELECT 1 FROM pd b WHERE b.pl = a.pl AND b.day BETWEEN a.day + 1 AND a.day + 7)) d7
     FROM pd a`, since)[0];
}

export function report(days: number) {
  const since = Date.now() - days * DAY;
  const one = <T>(sql: string, ...a: (string | number)[]) => query<T>(sql, ...a)[0];
  const kpi = (from: number) => one<{ views: number; visitors: number; players: number; searches: number; misses: number }>(
    `SELECT COUNT(*) views, COUNT(DISTINCT visitor) visitors,
            COUNT(DISTINCT CASE WHEN kind IN ('profile','stats','history') AND status = 200 THEN lower(player) END) players,
            SUM(kind = 'search') searches, SUM(kind = 'search' AND status = 404) misses
     FROM hits WHERE at >= ?`, from);
  const todayStart = Date.parse(new Date(Date.now() - 10800000).toISOString().slice(0, 10) + 'T03:00:00Z');
  return {
    days,
    funnel: funnel(since),
    retention: retention(Date.now() - Math.max(days, 30) * DAY),
    today: kpi(todayStart),
    period: kpi(since),
    daily: query<{ day: string; views: number; visitors: number }>(
      `SELECT ${LOCAL_DAY} day, COUNT(*) views, COUNT(DISTINCT visitor) visitors FROM hits WHERE at >= ? GROUP BY day ORDER BY day`,
      Date.now() - Math.max(days, 14) * DAY),
    players: query<{ player: string; region: string; views: number; visitors: number; last: number }>(
      `SELECT player, region, COUNT(*) views, COUNT(DISTINCT visitor) visitors, MAX(at) last
       FROM hits WHERE at >= ? AND kind IN ('profile','stats','history','profile·aba','stats·aba') AND status = 200 AND player IS NOT NULL
       GROUP BY lower(player), region ORDER BY views DESC, last DESC LIMIT 40`, since),
    searches: query<{ at: number; player: string; status: number; country: string | null }>(
      `SELECT at, player, status, country FROM hits WHERE kind = 'search' AND player IS NOT NULL ORDER BY at DESC LIMIT 40`),
    kinds: query<{ kind: string; views: number; ms: number }>(
      `SELECT kind, COUNT(*) views, CAST(AVG(ms) AS INT) ms FROM hits WHERE at >= ? GROUP BY kind ORDER BY views DESC`, since),
    refs: query<{ ref: string; views: number }>(
      `SELECT ref, COUNT(*) views FROM hits WHERE at >= ? AND ref IS NOT NULL GROUP BY ref ORDER BY views DESC LIMIT 12`, since),
    countries: query<{ country: string; visitors: number }>(
      `SELECT country, COUNT(DISTINCT visitor) visitors FROM hits WHERE at >= ? AND country IS NOT NULL GROUP BY country ORDER BY visitors DESC LIMIT 12`, since),
    errors: query<{ path: string; status: number; n: number; last: number }>(
      `SELECT path, status, COUNT(*) n, MAX(at) last FROM hits WHERE at >= ? AND status >= 500 GROUP BY path, status ORDER BY last DESC LIMIT 12`, since),
    recent: query<{ at: number; kind: string; path: string; status: number; country: string | null; ms: number }>(
      'SELECT at, kind, path, status, country, ms FROM hits ORDER BY at DESC LIMIT 30'),
  };
}
export type Report = ReturnType<typeof report>;
