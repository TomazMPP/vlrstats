// The current act of a player, summarised for the recap page and its share image.
import { groupBy, totals, type Line, type Profile } from './data.js';
import { acts, type RrPoint } from './history.js';
import { img } from './lib.js';
import type { OgAct, OgRank } from './og.js';

export type Recap = { act: OgAct; rank: OgRank; lines: Line[] };

/** `lines` and `rr` oldest first (as loadHistory returns them). */
export function recap(p: Profile, lines: Line[], rr: RrPoint[]): Recap | null {
  const last = p.matches[0] ?? null;
  const seasonId = last?.seasonId || lines.at(-1)?.seasonId || '';
  const short = last?.season || rr.at(-1)?.season || '';
  if (!seasonId) return null;
  const mine = lines.filter((l) => l.seasonId === seasonId);
  if (!mine.length) return null;

  const t = totals(mine);
  const official = acts(p.mmr?.seasonal ?? []).find((a) => a.short === short);
  const games = Math.max(official?.games ?? 0, t.games);
  const wins = official && official.games >= t.games ? official.wins : t.wins;

  let streak = 0, best = 0;
  for (const l of mine) { streak = l.win ? streak + 1 : 0; best = Math.max(best, streak); }

  const pts = rr.filter((x) => x.season === short && !x.placement);
  const agent = groupBy(mine, 'agent')[0] ?? null;
  const map = groupBy(mine, 'map').filter((g) => g.games >= 3).sort((a, b) => b.winRate - a.winRate || b.games - a.games)[0] ?? null;

  const cur = p.mmr?.current;
  const tier = cur?.tier.id ?? official?.end ?? 0;
  return {
    lines: mine,
    rank: { tier, rr: cur?.rr ?? official?.endRr ?? 0, peak: Math.max(official?.peak ?? 0, tier), icon: tier >= 3 ? img.rank(tier) : null },
    act: {
      short, games, wins, losses: games - wins,
      rrNet: pts.length ? pts.reduce((n, x) => n + x.change, 0) : null,
      streak: best, kd: t.kd, acs: t.acs, hsRate: t.hsRate,
      agent: agent ? { name: agent.name, icon: agent.id ? img.agent(agent.id) : null, games: agent.games } : null,
      map: map ? { name: map.name, winRate: map.winRate, games: map.games } : null,
    },
  };
}
