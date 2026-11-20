// Data layer: fetch from HenrikDev through the cache, compact matches, aggregate stats.
import { henrik, ApiError } from './henrik.js';
import { cached, getMatch, putMatch, recentMatches } from './db.js';
import { isRegion, ratio, seg, type Queue, type Region } from './lib.js';

// ---- API shapes (only the fields we read) ----------------------------------

type Ref = { id: string; name: string };
type Tier = { id: number; name: string };
type Account = { puuid: string; region: string; account_level: number; name: string; tag: string; card: string };
type Mmr = {
  peak: { season: { short: string }; tier: Tier; rr: number } | null;
  current: { tier: Tier; rr: number; last_change: number; elo: number; games_needed_for_rating: number; leaderboard_placement: { rank: number } | null };
  seasonal: { season: { id: string; short: string }; wins: number; games: number }[];
};
type HistoryEntry = { match_id: string; tier: Tier; rr: number; last_change: number; elo: number; date: string; season: { id: string; short: string } };
type V4Player = {
  puuid: string; name: string; tag: string; team_id: string; agent: Ref; account_level: number;
  stats: { score: number; kills: number; deaths: number; assists: number; headshots: number; bodyshots: number; legshots: number; damage: { dealt: number } };
  tier: Tier; customization: { card: string };
};
type V4Match = {
  metadata: {
    match_id: string; map: Ref; game_length_in_ms: number; started_at: string; is_completed: boolean;
    queue: { id: string; name: string; mode_type: string }; season: { id: string; short: string }; region: string; cluster: string;
  };
  players: V4Player[];
  teams: { team_id: string; rounds: { won: number; lost: number }; won: boolean }[];
  rounds: { id: number; winning_team: string; winning_team_role: string }[];
  kills: { round: number; time_in_round_in_ms: number; killer: { puuid: string }; victim: { puuid: string }; weapon: { name: string | null } | null }[];
};
type Stored = {
  meta: { id: string; map: Ref; mode: string; started_at: string; season: { id: string; short: string } };
  stats: { puuid: string; team: string; character: Ref; tier: number; score: number; kills: number; deaths: number; assists: number; shots: { head: number; body: number; leg: number }; damage: { made: number } };
  teams: { red: number; blue: number };
};

// ---- compact match (what we persist: ~3 KB instead of ~300 KB) -------------

export type CPlayer = {
  puuid: string; name: string; tag: string; team: string; agent: string; agentId: string; tier: number; level: number; card: string;
  score: number; k: number; d: number; a: number; hs: number; bs: number; ls: number; dmg: number; fk: number; fd: number;
  weapons: Record<string, number>; atk: [number, number]; def: [number, number];
};
export type CMatch = {
  id: string; map: string; mapId: string; queue: string; queueName: string; started: number; length: number;
  region: string; cluster: string; season: string; seasonId: string;
  teams: Record<string, { won: number; lost: number; win: boolean }>;
  rounds: { w: string; role: string }[];
  players: CPlayer[];
};

const otherRole = (r: string) => (r === 'Attacker' ? 'Defender' : 'Attacker');

export function compact(m: V4Match): CMatch {
  const md = m.metadata;
  const fk = new Map<string, number>();
  const fd = new Map<string, number>();
  const weapons = new Map<string, Record<string, number>>();
  const first = new Map<number, V4Match['kills'][number]>();
  for (const k of m.kills ?? []) {
    const f = first.get(k.round);
    if (!f || k.time_in_round_in_ms < f.time_in_round_in_ms) first.set(k.round, k);
    if (!k.killer?.puuid || k.killer.puuid === k.victim?.puuid) continue;
    const w = k.weapon?.name ?? 'Habilidade';
    const rec = weapons.get(k.killer.puuid) ?? {};
    rec[w] = (rec[w] ?? 0) + 1;
    weapons.set(k.killer.puuid, rec);
  }
  for (const k of first.values()) {
    if (k.killer?.puuid) fk.set(k.killer.puuid, (fk.get(k.killer.puuid) ?? 0) + 1);
    if (k.victim?.puuid) fd.set(k.victim.puuid, (fd.get(k.victim.puuid) ?? 0) + 1);
  }
  const rounds = (m.rounds ?? []).map((r) => ({ w: r.winning_team, role: r.winning_team_role }));

  const players: CPlayer[] = m.players.map((p) => {
    const atk: [number, number] = [0, 0];
    const def: [number, number] = [0, 0];
    for (const r of rounds) {
      if (!r.role) continue;
      const won = r.w === p.team_id;
      const side = won ? r.role : otherRole(r.role);
      const bucket = side === 'Attacker' ? atk : def;
      bucket[1]++;
      if (won) bucket[0]++;
    }
    const s = p.stats;
    return {
      puuid: p.puuid, name: p.name, tag: p.tag, team: p.team_id, agent: p.agent.name, agentId: p.agent.id,
      tier: p.tier?.id ?? 0, level: p.account_level, card: p.customization?.card ?? '',
      score: s.score, k: s.kills, d: s.deaths, a: s.assists, hs: s.headshots, bs: s.bodyshots, ls: s.legshots,
      dmg: s.damage?.dealt ?? 0, fk: fk.get(p.puuid) ?? 0, fd: fd.get(p.puuid) ?? 0,
      weapons: weapons.get(p.puuid) ?? {}, atk, def,
    };
  });

  const teams: CMatch['teams'] = {};
  for (const t of m.teams ?? []) teams[t.team_id] = { won: t.rounds.won, lost: t.rounds.lost, win: t.won };

  return {
    id: md.match_id, map: md.map?.name ?? '—', mapId: md.map?.id ?? '', queue: md.queue?.id ?? 'custom',
    queueName: md.queue?.name ?? 'Personalizada', started: Date.parse(md.started_at), length: md.game_length_in_ms,
    region: md.region, cluster: md.cluster, season: md.season?.short ?? '', seasonId: md.season?.id ?? '',
    teams, rounds, players,
  };
}

// ---- loaders -----------------------------------------------------------------

const TTL = { account: 3600, mmr: 300, history: 300, matches: 300, stored: 600 };
const keyOf = (region: string, name: string, tag: string) => `${region}:${name.toLowerCase()}#${tag.toLowerCase()}`;
export const playerPrefix = keyOf;
/** Account lookup is region-agnostic, so it is cached once per Riot ID. */
export const accountKey = (name: string, tag: string) => `acct:${name.toLowerCase()}#${tag.toLowerCase()}`;

export const findAccount = (name: string, tag: string) =>
  cached(accountKey(name, tag), TTL.account, () => henrik<Account>(`/valorant/v2/account/${seg(name)}/${seg(tag)}`));

/** The account's home region (where its ranked data lives), when the API says. */
export const regionOf = (a: Account): Region | null => {
  const r = a.region?.toLowerCase() ?? '';
  return isRegion(r) ? r : null;
};

/** Optional data: 404 → null, other errors → null + warning. */
async function optional<T>(p: Promise<{ value: T; stale: boolean }>): Promise<{ value: T | null; warn: boolean }> {
  try {
    const r = await p;
    return { value: r.value, warn: r.stale };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return { value: null, warn: false };
    return { value: null, warn: true };
  }
}

export type Profile = Awaited<ReturnType<typeof loadProfile>>;

export async function loadProfile(region: Region, name: string, tag: string, queue: Queue, pages = 1) {
  const key = keyOf(region, name, tag);
  const path = `/${region}/pc/${seg(name)}/${seg(tag)}`;
  const mode = queue === 'all' ? '' : `&mode=${queue}`;

  const accountP = findAccount(name, tag);
  const mmrP = optional(cached(`${key}:mmr`, TTL.mmr, () => henrik<Mmr>(`/valorant/v3/mmr${path}`)));
  const histP = optional(cached(`${key}:history`, TTL.history, async () =>
    (await henrik<{ history: HistoryEntry[] }>(`/valorant/v2/mmr-history${path}`)).history ?? []));
  const page = (i: number) => optional(cached(`${key}:matches:${queue}:${i}`, TTL.matches, async () => {
    const list = await henrik<V4Match[]>(`/valorant/v4/matches${path}?size=10&start=${i * 10}${mode}`);
    const ids: string[] = [];
    for (const m of list ?? []) {
      if (!m.metadata?.is_completed) continue;
      putMatch(compact(m));
      ids.push(m.metadata.match_id);
    }
    return ids;
  }));
  const listP = Promise.all(Array.from({ length: pages }, (_, i) => page(i)));

  const account = await accountP; // 404 here = player doesn't exist
  const [mmr, hist, list] = await Promise.all([mmrP, histP, listP]);
  const puuid = account.value.puuid;
  const matches = recentMatches<CMatch>(puuid, queue === 'all' ? null : queue, pages * 10);
  const fetched = list.reduce((n, l) => n + (l.value?.length ?? 0), 0);
  const compMatches = queue === 'competitive' ? matches : recentMatches<CMatch>(puuid, 'competitive', 20);

  return {
    region, account: account.value, fetchedAt: account.at,
    mmr: mmr.value, history: hist.value ?? [], matches,
    lobby: lobbyEstimate(puuid, compMatches, hist.value ?? []),
    hasMore: fetched >= pages * 10 && pages < 5,
    warn: account.stale || mmr.warn || hist.warn || list.some((l) => l.warn),
  };
}

/** Light per-match lines for many matches in a single request (stats page). */
export async function loadStored(region: Region, name: string, tag: string, queue: Queue) {
  const key = keyOf(region, name, tag);
  const mode = queue === 'all' ? '' : `&mode=${queue}`;
  return optional(cached(`${key}:stored:${queue}`, TTL.stored, async () => {
    const list = await henrik<Stored[]>(`/valorant/v1/stored-matches/${region}/${seg(name)}/${seg(tag)}?size=50${mode}`);
    return (list ?? []).map(storedLine);
  }));
}

export async function loadMatch(region: Region, id: string): Promise<CMatch> {
  const hit = getMatch<CMatch>(id);
  if (hit) return hit;
  const m = await henrik<V4Match>(`/valorant/v4/match/${region}/${seg(id)}`);
  const c = compact(m);
  if (m.metadata?.is_completed) putMatch(c);
  return c;
}

// ---- aggregation -----------------------------------------------------------

export type Line = {
  id: string; map: string; mapId: string; agent: string; agentId: string; started: number; seasonId: string;
  win: boolean; draw: boolean; rounds: number; score: number; k: number; d: number; a: number;
  hs: number; bs: number; ls: number; dmg: number; fk: number | null;
};

function storedLine(s: Stored): Line {
  const mine = s.stats.team?.toLowerCase() === 'red' ? s.teams.red : s.teams.blue;
  const theirs = s.stats.team?.toLowerCase() === 'red' ? s.teams.blue : s.teams.red;
  return {
    id: s.meta.id, map: s.meta.map?.name ?? '—', mapId: s.meta.map?.id ?? '', agent: s.stats.character?.name ?? '—',
    agentId: s.stats.character?.id ?? '', started: Date.parse(s.meta.started_at), seasonId: s.meta.season?.id ?? '',
    win: mine > theirs, draw: mine === theirs, rounds: (s.teams.red ?? 0) + (s.teams.blue ?? 0),
    score: s.stats.score, k: s.stats.kills, d: s.stats.deaths, a: s.stats.assists,
    hs: s.stats.shots?.head ?? 0, bs: s.stats.shots?.body ?? 0, ls: s.stats.shots?.leg ?? 0, dmg: s.stats.damage?.made ?? 0, fk: null,
  };
}

export function lineOf(m: CMatch, puuid: string): Line | null {
  const p = m.players.find((x) => x.puuid === puuid);
  if (!p) return null;
  const t = m.teams[p.team];
  const others = Object.entries(m.teams).filter(([id]) => id !== p.team);
  const draw = !!t && others.length > 0 && others.every(([, o]) => o.won === t.won) && !t.win;
  return {
    id: m.id, map: m.map, mapId: m.mapId, agent: p.agent, agentId: p.agentId, started: m.started, seasonId: m.seasonId,
    win: !!t?.win, draw, rounds: m.rounds.length || 1, score: p.score, k: p.k, d: p.d, a: p.a,
    hs: p.hs, bs: p.bs, ls: p.ls, dmg: p.dmg, fk: p.fk,
  };
}

export type Totals = ReturnType<typeof totals>;
export function totals(lines: Line[]) {
  const t = { games: 0, wins: 0, losses: 0, rounds: 0, score: 0, k: 0, d: 0, a: 0, hs: 0, bs: 0, ls: 0, dmg: 0, fk: 0, fkGames: 0 };
  for (const l of lines) {
    t.games++;
    if (l.win) t.wins++;
    else if (!l.draw) t.losses++;
    t.rounds += l.rounds; t.score += l.score; t.k += l.k; t.d += l.d; t.a += l.a;
    t.hs += l.hs; t.bs += l.bs; t.ls += l.ls; t.dmg += l.dmg;
    if (l.fk != null) { t.fk += l.fk; t.fkGames++; }
  }
  const shots = t.hs + t.bs + t.ls;
  return {
    ...t,
    kd: ratio(t.k, t.d), kda: ratio(t.k + t.a, t.d), winRate: ratio(t.wins, t.games),
    hsRate: ratio(t.hs, shots), bodyRate: ratio(t.bs, shots), legRate: ratio(t.ls, shots), shots,
    acs: ratio(t.score, t.rounds), adr: ratio(t.dmg, t.rounds), fkPerGame: ratio(t.fk, t.fkGames),
  };
}

export function groupBy(lines: Line[], key: 'agent' | 'map') {
  const g = new Map<string, Line[]>();
  for (const l of lines) g.set(l[key], [...(g.get(l[key]) ?? []), l]);
  return [...g.entries()]
    .map(([name, ls]) => ({ name, id: key === 'agent' ? ls[0].agentId : ls[0].mapId, ...totals(ls) }))
    .sort((a, b) => b.games - a.games || b.winRate - a.winRate);
}

export function weaponsAndSides(matches: CMatch[], puuid: string) {
  const w = new Map<string, number>();
  const atk = [0, 0];
  const def = [0, 0];
  let n = 0;
  for (const m of matches) {
    const p = m.players.find((x) => x.puuid === puuid);
    if (!p) continue;
    n++;
    for (const [name, k] of Object.entries(p.weapons)) w.set(name, (w.get(name) ?? 0) + k);
    atk[0] += p.atk[0]; atk[1] += p.atk[1]; def[0] += p.def[0]; def[1] += p.def[1];
  }
  const weapons = [...w.entries()].map(([name, kills]) => ({ name, kills })).sort((a, b) => b.kills - a.kills);
  return { matches: n, weapons, atk, def };
}

/**
 * Estimated MMR. Riot doesn't expose hidden MMR; matchmaking builds lobbies
 * around it, so the average visible rank of the other 9 players is a good
 * proxy. RR gains vs losses hint at the same thing (MMR above rank → bigger gains).
 */
export function lobbyEstimate(puuid: string, matches: CMatch[], history: HistoryEntry[]) {
  let sum = 0, n = 0, games = 0;
  for (const m of matches) {
    if (m.queue !== 'competitive' || !m.players.some((p) => p.puuid === puuid)) continue;
    let g = 0;
    for (const p of m.players) {
      if (p.puuid === puuid || p.tier < 3) continue;
      sum += p.tier; n++; g++;
    }
    if (g) games++;
  }
  const recent = history.slice(0, 20);
  const gains = recent.filter((h) => h.last_change > 0).map((h) => h.last_change);
  const losses = recent.filter((h) => h.last_change < 0).map((h) => -h.last_change);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return { avgTier: n ? sum / n : null, games, avgGain: avg(gains), avgLoss: avg(losses) };
}
