// Who a player queues with (Riot party id from v4 matches) and who keeps
// showing up in their lobbies, from the detailed matches we have stored.
import { recentMatches } from './db.js';
import { hasDetail, lineOf, type CMatch } from './data.js';
import type { RrPoint } from './history.js';
import { ratio } from './lib.js';

export type Agg = { games: number; wins: number; losses: number; rr: number; rrGames: number; k: number; d: number };
const agg = (): Agg => ({ games: 0, wins: 0, losses: 0, rr: 0, rrGames: 0, k: 0, d: 0 });
export const winRate = (a: Agg) => ratio(a.wins, a.games);
export const rrAvg = (a: Agg) => (a.rrGames ? a.rr / a.rrGames : null);

export type Mate = Agg & { puuid: string; name: string; tag: string; card: string; last: number };
export type Seen = { puuid: string; name: string; tag: string; card: string; with: number; against: number; withWins: number; againstWins: number; last: number };

export function social(puuid: string, rrs: Map<string, RrPoint>, limit = 150) {
  const ms = recentMatches<CMatch>(puuid, 'competitive', limit).filter(hasDetail);
  const solo = agg(), group = agg();
  const mates = new Map<string, Mate>();
  const seen = new Map<string, Seen>();
  const add = (a: Agg, win: boolean, draw: boolean, rr: number | undefined, k: number, d: number) => {
    a.games++;
    if (win) a.wins++; else if (!draw) a.losses++;
    if (rr != null) { a.rr += rr; a.rrGames++; }
    a.k += k; a.d += d;
  };
  for (const m of ms) {
    const me = m.players.find((p) => p.puuid === puuid);
    const l = lineOf(m, puuid);
    if (!me || !l) continue;
    const pt = rrs.get(m.id);
    const rr = pt && !pt.placement ? pt.change : undefined;
    const party = me.party ? m.players.filter((p) => p.party === me.party && p.puuid !== puuid) : [];
    add(party.length ? group : solo, l.win, l.draw, rr, me.k, me.d);
    for (const p of party) {
      const x = mates.get(p.puuid) ?? { ...agg(), puuid: p.puuid, name: p.name, tag: p.tag, card: p.card, last: 0 };
      add(x, l.win, l.draw, rr, me.k, me.d);
      if (m.started > x.last) Object.assign(x, { name: p.name, tag: p.tag, card: p.card, last: m.started });
      mates.set(p.puuid, x);
    }
    for (const p of m.players) {
      if (p.puuid === puuid || party.includes(p)) continue;
      const x = seen.get(p.puuid) ?? { puuid: p.puuid, name: p.name, tag: p.tag, card: p.card, with: 0, against: 0, withWins: 0, againstWins: 0, last: 0 };
      if (p.team === me.team) { x.with++; if (l.win) x.withWins++; } else { x.against++; if (l.win) x.againstWins++; }
      if (m.started > x.last) Object.assign(x, { name: p.name, tag: p.tag, card: p.card, last: m.started });
      seen.set(p.puuid, x);
    }
  }
  const partners = [...mates.values()].sort((a, b) => b.games - a.games || b.last - a.last);
  // best / worst duo: enough games to mean something, ranked by win rate then RR
  const ranked = partners.filter((p) => p.games >= 3)
    .sort((a, b) => winRate(b) - winRate(a) || (rrAvg(b) ?? 0) - (rrAvg(a) ?? 0));
  const best = ranked[0] ?? null;
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;
  const encounters = [...seen.values()].filter((s) => s.with + s.against >= 2)
    .sort((a, b) => b.with + b.against - (a.with + a.against) || b.last - a.last).slice(0, 8);
  return { games: solo.games + group.games, solo, group, partners: partners.slice(0, 10), best, worst, encounters };
}
export type Social = ReturnType<typeof social>;
