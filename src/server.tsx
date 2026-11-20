import { Hono, type Context } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { compress } from 'hono/compress';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { secureHeaders } from 'hono/secure-headers';
import { basicAuth } from 'hono/basic-auth';
import { HTTPException } from 'hono/http-exception';
import { ApiError } from './henrik.js';
import { invalidate, recentMatches, sharedMatches } from './db.js';
import { accountKey, findAccount, loadMatch, loadProfile, loadStored, playerPrefix, regionFromMatches, regionOf, weaponsAndSides, type CMatch } from './data.js';
import { isQueue, isRegion, profileUrl, shardOf, type Region } from './lib.js';
import { Home, type Recent } from './views/home.js';
import { ProfilePage } from './views/profile.js';
import { StatsPage, PERIODS, type Period } from './views/stats.js';
import { MatchPage } from './views/match.js';
import { ComparePage, headToHead, type Side } from './views/compare.js';
import { HistoryPage } from './views/history.js';
import { AdminPage } from './views/admin.js';
import { acts, loadHistory, months, rrByMatch } from './history.js';
import { report, track } from './analytics.js';
import { startRefresh } from './refresh.js';
import { social } from './social.js';
import { ApiFailure, NotFound, RateLimited } from './views/states.js';

const app = new Hono();
const PROD = process.env.NODE_ENV === 'production';

app.use(compress());
app.use(secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    imgSrc: ["'self'", 'https://media.valorant-api.com', 'data:'],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ['https://fonts.gstatic.com'],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    scriptSrcAttr: ["'unsafe-inline'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(track);

// ---- private analytics (HTTP basic auth; off unless ADMIN_PASSWORD is set) ----
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() ?? '';
app.use('/admin', async (c, next) => {
  if (ADMIN_PASSWORD.length < 12) return c.html(<NotFound what="page" />, 404);
  c.header('Cache-Control', 'no-store');
  c.header('X-Robots-Tag', 'noindex');
  return basicAuth({ username: 'admin', password: ADMIN_PASSWORD, realm: 'vlrstats' })(c, next);
});
app.get('/admin', (c) => {
  const d = Number(c.req.query('d'));
  return c.html(<AdminPage r={report([1, 7, 30, 90].includes(d) ? d : 7)} />);
});

app.use('/styles.css', async (c, next) => { await next(); c.header('Cache-Control', 'public, max-age=31536000, immutable'); });
app.use('/favicon.svg', async (c, next) => { await next(); c.header('Cache-Control', 'public, max-age=604800'); });
app.use('/styles.css', serveStatic({ root: './public' }));
app.use('/favicon.svg', serveStatic({ root: './public' }));
app.use('/app.js', async (c, next) => { await next(); c.header('Cache-Control', 'public, max-age=31536000, immutable'); });
app.use('/app.js', serveStatic({ root: './public' }));

// ---- recent searches (cookie, no server state) ------------------------------

const RECENT = 'recent';
function readRecent(c: Context): Recent[] {
  try {
    const raw = getCookie(c, RECENT);
    if (!raw) return [];
    const list = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    return Array.isArray(list) ? list.filter((x) => x && typeof x.n === 'string' && typeof x.t === 'string' && isRegion(x.r)).slice(0, 6) : [];
  } catch {
    return [];
  }
}
function pushRecent(c: Context, e: Recent) {
  const same = (x: Recent) => x.r === e.r && x.n.toLowerCase() === e.n.toLowerCase() && x.t.toLowerCase() === e.t.toLowerCase();
  const list = [e, ...readRecent(c).filter((x) => !same(x))].slice(0, 6);
  setCookie(c, RECENT, Buffer.from(JSON.stringify(list)).toString('base64url'), {
    path: '/', maxAge: 60 * 60 * 24 * 180, httpOnly: true, sameSite: 'Lax', secure: PROD,
  });
}

// ---- params -------------------------------------------------------------------

/** Riot names: 3–16 chars, tags 3–5. We're lenient but cap length and strip '#'. */
function parsePlayer(c: Context) {
  const region = c.req.param('region') ?? '';
  const name = (c.req.param('name') ?? '').trim();
  const tag = (c.req.param('tag') ?? '').trim();
  if (!isRegion(region) || !name || !tag || name.length > 16 || tag.length > 5 || /[#/]/.test(name + tag)) return null;
  return { region, name, tag };
}

function fail(c: Context, e: unknown, kind: 'player' | 'match', riotid?: string) {
  if (e instanceof ApiError) {
    if (e.status === 404) return c.html(<NotFound what={kind} riotid={riotid} />, 404);
    if (e.status === 429) return c.html(<RateLimited wait={e.retryAfter || 30} retry={c.req.url} />, 429);
  }
  console.error(`[error] ${c.req.method} ${c.req.path}`, e instanceof Error ? e.message : e);
  return c.html(<ApiFailure retry={c.req.url} />, 502);
}

// ---- routes -------------------------------------------------------------------

app.get('/', (c) => {
  return c.html(<Home recent={readRecent(c)}
    value={c.req.query('riotid')} hint={c.req.query('e') === '1' ? 'Use o formato Nome#TAG, com o # antes do TAG.' : undefined} />);
});

// Region is detected from the account; BR is the default when the API doesn't say.
app.get('/search', async (c) => {
  const raw = (c.req.query('riotid') ?? '').trim();
  const i = raw.lastIndexOf('#');
  const name = i > 0 ? raw.slice(0, i).trim() : '';
  const tag = i > 0 ? raw.slice(i + 1).trim() : '';
  if (!name || !tag || name.length > 16 || tag.length > 5 || /[#/]/.test(name + tag)) {
    return c.redirect(`/?e=1&riotid=${encodeURIComponent(raw.slice(0, 32))}`);
  }
  try {
    const { value: a } = await findAccount(name, tag);
    return c.redirect(profileUrl(regionOf(a) ?? 'br', a.name, a.tag));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return fail(c, e, 'player', `${name}#${tag}`);
    return c.redirect(profileUrl('br', name, tag)); // API hiccup: the profile page handles errors
  }
});

/** If the URL's region isn't the account's home region, the canonical URL to send the user to. */
async function homeUrl(c: Context, pl: { region: Region; name: string; tag: string }, suffix = '') {
  const { value: a } = await findAccount(pl.name, pl.tag);
  const home = regionOf(a);
  // same shard (BR/LATAM/NA): the match clusters decide, see regionFix
  if (!home || shardOf(home) === shardOf(pl.region)) return null;
  return profileUrl(home, a.name, a.tag) + suffix + new URL(c.req.url).search;
}

/** On the NA shard, the URL region should match where the player's matches are played. */
function regionFix(c: Context, pl: { region: Region }, p: { matches: { cluster: string }[]; account: { name: string; tag: string } }, suffix = '') {
  if (shardOf(pl.region) !== 'na') return null;
  const where = regionFromMatches(p.matches);
  if (!where || where === pl.region) return null;
  return profileUrl(where, p.account.name, p.account.tag) + suffix + new URL(c.req.url).search;
}

/** "Nome#TAG" from a query value, or null. */
function parseId(raw: string | undefined) {
  const s = (raw ?? '').trim();
  const i = s.lastIndexOf('#');
  const name = i > 0 ? s.slice(0, i).trim() : '', tag = i > 0 ? s.slice(i + 1).trim() : '';
  if (!name || !tag || name.length > 16 || tag.length > 5 || /[#/]/.test(name + tag)) return null;
  return { name, tag };
}

/** A player's side of the comparison: profile + last 50 competitive lines. */
async function side(id: { name: string; tag: string }): Promise<Side> {
  const { value: acc } = await findAccount(id.name, id.tag);
  const region = regionOf(acc) ?? 'br';
  const p = await loadProfile(region, acc.name, acc.tag, 'competitive', 1);
  const fixed = shardOf(region) === 'na' ? regionFromMatches(p.matches) : null;
  const stored = await loadStored(fixed ?? region, acc.name, acc.tag, 'competitive');
  return { p: fixed && fixed !== region ? { ...p, region: fixed } : p, lines: stored.value ?? [] };
}

app.get('/compare', async (c) => {
  const raw = { a: (c.req.query('a') ?? '').slice(0, 40), b: (c.req.query('b') ?? '').slice(0, 40) };
  const a = parseId(raw.a), b = parseId(raw.b);
  if (!a) return c.redirect('/');
  let A: Side;
  try { A = await side(a); } catch (e) { return fail(c, e, 'player', `${a.name}#${a.tag}`); }
  if (!b) return c.html(<ComparePage A={A} B={null} h2h={null} raw={raw} />);
  let B: Side;
  try { B = await side(b); } catch (e) { return fail(c, e, 'player', `${b.name}#${b.tag}`); }
  const h2h = headToHead(sharedMatches<CMatch>(A.p.account.puuid, B.p.account.puuid), A.p.account.puuid, B.p.account.puuid);
  return c.html(<ComparePage A={A} B={B} h2h={h2h} raw={raw} />);
});

app.post('/recent/clear', (c) => {
  deleteCookie(c, RECENT, { path: '/' });
  return c.redirect('/', 303);
});

app.get('/p/:region/:name/:tag', async (c) => {
  const pl = parsePlayer(c);
  if (!pl) return c.html(<NotFound what="player" />, 404);
  const q = c.req.query('queue');
  const queue = isQueue(q) ? q : 'competitive';
  const pages = Math.min(5, Math.max(1, Math.ceil(Number(c.req.query('n') ?? 10) / 10) || 1));
  try {
    const moved = await homeUrl(c, pl);
    if (moved) return c.redirect(moved);
    const p = await loadProfile(pl.region, pl.name, pl.tag, queue, pages);
    const fixed = regionFix(c, pl, p);
    if (fixed) return c.redirect(fixed);
    pushRecent(c, { r: pl.region, n: p.account.name, t: p.account.tag, tier: p.mmr?.current.tier.id ?? 0, card: p.account.card ?? '', at: Date.now() });
    const rrs = rrByMatch(p.account.puuid, p.history);
    return c.html(<ProfilePage p={p} queue={queue} pages={pages} rrs={rrs} social={social(p.account.puuid, rrs)} />);
  } catch (e) {
    return fail(c, e, 'player', `${pl.name}#${pl.tag}`);
  }
});

app.post('/p/:region/:name/:tag/refresh', (c) => {
  const pl = parsePlayer(c);
  if (!pl) return c.redirect('/', 303);
  // only drop entries older than 30 s, so hammering the button can't burn the rate limit
  invalidate(playerPrefix(pl.region, pl.name, pl.tag) + ':', 30);
  invalidate(accountKey(pl.name, pl.tag), 30);
  return c.redirect(profileUrl(pl.region, pl.name, pl.tag), 303);
});

app.get('/p/:region/:name/:tag/history', async (c) => {
  const pl = parsePlayer(c);
  if (!pl) return c.html(<NotFound what="player" />, 404);
  try {
    const moved = await homeUrl(c, pl, '/history');
    if (moved) return c.redirect(moved);
    const p = await loadProfile(pl.region, pl.name, pl.tag, 'competitive');
    const fixed = regionFix(c, pl, p, '/history');
    if (fixed) return c.redirect(fixed);
    rrByMatch(p.account.puuid, p.history);
    const h = await loadHistory(pl.region, pl.name, pl.tag, p.account.puuid);
    return c.html(
      <HistoryPage region={pl.region} name={p.account.name} tag={p.account.tag} card={p.account.card} tier={p.mmr?.current.tier.id ?? 0}
        acts={acts(p.mmr?.seasonal ?? [])} rr={h.rr} lines={h.lines} months={months(h.lines)} warn={h.warn || p.warn} />,
    );
  } catch (e) {
    return fail(c, e, 'player', `${pl.name}#${pl.tag}`);
  }
});

app.get('/p/:region/:name/:tag/stats', async (c) => {
  const pl = parsePlayer(c);
  if (!pl) return c.html(<NotFound what="player" />, 404);
  const per = c.req.query('period');
  const period: Period = per && per in PERIODS ? (per as Period) : '50';
  try {
    const moved = await homeUrl(c, pl, '/stats');
    if (moved) return c.redirect(moved);
    const [p, stored] = await Promise.all([
      loadProfile(pl.region, pl.name, pl.tag, 'competitive'),
      loadStored(pl.region, pl.name, pl.tag, 'competitive'),
    ]);
    const fixed = regionFix(c, pl, p, '/stats');
    if (fixed) return c.redirect(fixed);
    const recent = (stored.value ?? []).sort((a, b) => b.started - a.started);
    const season = recent[0]?.seasonId ?? '';
    // 'act' and 'all' need more than the last 50: use the persisted history
    const deep = period === 'act' || period === 'all' ? await loadHistory(pl.region, p.account.name, p.account.tag, p.account.puuid) : null;
    const all = deep ? deep.lines.slice().sort((a, b) => b.started - a.started) : recent;
    const lines = period === '20' ? all.slice(0, 20) : period === 'act' ? all.filter((l) => l.seasonId === season) : all;
    const ids = new Set(lines.map((l) => l.id));
    const detailed = recentMatches<CMatch>(p.account.puuid, 'competitive', 200).filter((m) => ids.has(m.id));
    const seasonShort = p.matches.find((m) => m.seasonId === season)?.season ?? '';
    return c.html(<StatsPage region={pl.region} name={p.account.name} tag={p.account.tag} card={p.account.card}
      tier={p.mmr?.current.tier.id ?? 0} lines={lines} period={period} season={seasonShort}
      detail={weaponsAndSides(detailed, p.account.puuid)} warn={p.warn || stored.warn || !!deep?.warn} />);
  } catch (e) {
    return fail(c, e, 'player', `${pl.name}#${pl.tag}`);
  }
});

app.get('/m/:region/:id', async (c) => {
  const region = c.req.param('region');
  const id = c.req.param('id');
  if (!isRegion(region) || !/^[0-9a-f-]{36}$/i.test(id)) return c.html(<NotFound what="match" />, 404);
  try {
    const m = await loadMatch(region as Region, id);
    const me = m.players.find((p) => p.puuid === c.req.query('p'));
    c.header('Cache-Control', 'private, max-age=300');
    return c.html(<MatchPage m={m} me={me} region={region} />);
  } catch (e) {
    return fail(c, e, 'match');
  }
});

app.notFound((c) => c.html(<NotFound what="page" />, 404));
app.onError((e, c) => (e instanceof HTTPException ? e.getResponse() : fail(c, e, 'player')));

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port, hostname: process.env.HOST ?? "127.0.0.1" }, () => console.log(`vlrstats on http://localhost:${port}`));
startRefresh();
