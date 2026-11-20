// Background refresh: once a day, re-fetch the RR history, match lines and
// latest matches of every player someone viewed in the last 30 days, so their
// history keeps growing even when nobody opens the profile. HenrikDev only
// returns a limited window, and what falls out of it before we store it is lost.
//
// Gentle on the shared rate limit (~30 req/min): one player at a time, a pause
// between players, and it backs off whenever visitors are using the budget.
import { cached, query } from './db.js';
import { rateLeft } from './henrik.js';
import { findAccount, matchPage, playerPrefix } from './data.js';
import { loadHistory } from './history.js';
import { isRegion } from './lib.js';

const DAY = 86400_000;
const EVERY = 20 * 3600;        // refresh a player at most once per 20 h
const GAP = 40_000;             // pause between players (~4 requests each)
const MIN_BUDGET = 15;          // leave this many requests per minute to visitors
const MAX_PER_RUN = 400;

const KINDS = "('profile','stats','history','profile·aba','stats·aba','refresh')";

/** Players with a successful page view in the last 30 days, most recent first. */
export const watched = () => query<{ player: string; region: string }>(
  `SELECT player, region FROM hits
   WHERE at >= ? AND status = 200 AND player IS NOT NULL AND region IS NOT NULL AND kind IN ${KINDS}
   GROUP BY lower(player), region ORDER BY MAX(at) DESC`, Date.now() - 30 * DAY);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function refreshOne(region: string, player: string) {
  const i = player.lastIndexOf('#');
  if (i < 1 || !isRegion(region)) return false;
  const name = player.slice(0, i), tag = player.slice(i + 1);
  // the mark lives in the cache table: once per EVERY, survives restarts
  let did = false;
  await cached(`auto:${playerPrefix(region, name, tag)}`, EVERY, async () => {
    did = true;
    const acc = await findAccount(name, tag);
    await loadHistory(region, acc.value.name, acc.value.tag, acc.value.puuid);
    await matchPage(region, acc.value.name, acc.value.tag, 'competitive', 0).catch(() => null);
    return Date.now();
  });
  return did;
}

let running = false;
export async function runRefresh(log = console.log) {
  if (running) return;
  running = true;
  let done = 0, failed = 0;
  try {
    for (const { player, region } of watched()) {
      if (done >= MAX_PER_RUN) break;
      while (rateLeft() < MIN_BUDGET) await sleep(15_000);
      try {
        if (await refreshOne(region, player)) { done++; await sleep(GAP); }
      } catch {
        failed++; // 404 (renamed account), outage: try again next run
        await sleep(GAP);
      }
    }
  } finally {
    running = false;
    if (done || failed) log(`[refresh] ${done} players refreshed, ${failed} failed`);
  }
}

/** Check every hour; the per-player mark makes each player run about once a day. */
export function startRefresh() {
  if (process.env.AUTO_REFRESH === '0') return;
  const tick = () => { runRefresh().catch((e) => console.error('[refresh]', e)); };
  setTimeout(tick, 5 * 60_000).unref();
  setInterval(tick, 3600_000).unref();
}
