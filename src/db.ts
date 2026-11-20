// SQLite storage (built-in node:sqlite): a TTL key/value cache for volatile
// endpoints, plus permanent storage for finished matches (they never change).
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ApiError } from './henrik.js';

const path = process.env.DB_PATH ?? 'data/vlrstats.db';
mkdirSync(dirname(path), { recursive: true });
const db = new DatabaseSync(path);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL, at INTEGER NOT NULL, exp INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS matches (id TEXT PRIMARY KEY, started INTEGER NOT NULL, queue TEXT NOT NULL, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS player_matches (
    puuid TEXT NOT NULL, id TEXT NOT NULL, started INTEGER NOT NULL, queue TEXT NOT NULL,
    PRIMARY KEY (puuid, id)
  );
  CREATE INDEX IF NOT EXISTS player_matches_recent ON player_matches (puuid, queue, started DESC);
`);

const qGet = db.prepare('SELECT v, at, exp FROM kv WHERE k = ?');
const qSet = db.prepare('INSERT OR REPLACE INTO kv (k, v, at, exp) VALUES (?, ?, ?, ?)');
const qDelPrefix = db.prepare("DELETE FROM kv WHERE k LIKE ? ESCAPE '\\' AND at < ?");

export type Cached<T> = { value: T; at: number; stale: boolean };

/**
 * Return a fresh cached value, or call `load` and store it. If `load` fails
 * (rate limit, outage) and an expired copy exists, serve it marked stale.
 * A 404 is never masked by stale data.
 */
export async function cached<T>(key: string, ttlSec: number, load: () => Promise<T>): Promise<Cached<T>> {
  const row = qGet.get(key) as { v: string; at: number; exp: number } | undefined;
  const now = Date.now();
  if (row && row.exp > now) return { value: JSON.parse(row.v), at: row.at, stale: false };
  try {
    const value = await load();
    qSet.run(key, JSON.stringify(value), now, now + ttlSec * 1000);
    return { value, at: now, stale: false };
  } catch (e) {
    if (row && !(e instanceof ApiError && e.status === 404)) {
      return { value: JSON.parse(row.v), at: row.at, stale: true };
    }
    throw e;
  }
}

/** Expire cached entries under a prefix, but only ones older than `minAgeSec` (anti-spam). */
export function invalidate(prefix: string, minAgeSec: number) {
  const like = prefix.replace(/[\\%_]/g, (c) => '\\' + c) + '%';
  return Number(qDelPrefix.run(like, Date.now() - minAgeSec * 1000).changes);
}

// ---- permanent match store -------------------------------------------------

const qMatchGet = db.prepare('SELECT data FROM matches WHERE id = ?');
const qMatchPut = db.prepare('INSERT OR IGNORE INTO matches (id, started, queue, data) VALUES (?, ?, ?, ?)');
const qLink = db.prepare('INSERT OR IGNORE INTO player_matches (puuid, id, started, queue) VALUES (?, ?, ?, ?)');
const qRecentAll = db.prepare(
  'SELECT m.data FROM player_matches p JOIN matches m ON m.id = p.id WHERE p.puuid = ? ORDER BY p.started DESC LIMIT ?',
);
const qRecentQueue = db.prepare(
  'SELECT m.data FROM player_matches p JOIN matches m ON m.id = p.id WHERE p.puuid = ? AND p.queue = ? ORDER BY p.started DESC LIMIT ?',
);

export function getMatch<T>(id: string): T | undefined {
  const row = qMatchGet.get(id) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : undefined;
}

export function putMatch(m: { id: string; started: number; queue: string; players: { puuid: string }[] }) {
  db.exec('BEGIN');
  try {
    qMatchPut.run(m.id, m.started, m.queue, JSON.stringify(m));
    for (const p of m.players) qLink.run(p.puuid, m.id, m.started, m.queue);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function recentMatches<T>(puuid: string, queue: string | null, limit: number): T[] {
  const rows = (queue ? qRecentQueue.all(puuid, queue, limit) : qRecentAll.all(puuid, limit)) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data));
}

// ---- per-player history that outlives the API's window --------------------
// RR changes and stored-match lines are kept forever, so a profile's history
// keeps growing even after HenrikDev stops returning its oldest entries.

db.exec(`
  CREATE TABLE IF NOT EXISTS rr_history (puuid TEXT NOT NULL, id TEXT NOT NULL, at INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (puuid, id));
  CREATE TABLE IF NOT EXISTS match_lines (puuid TEXT NOT NULL, id TEXT NOT NULL, at INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (puuid, id));
`);

const keep = {
  rr_history: db.prepare('INSERT OR REPLACE INTO rr_history (puuid, id, at, data) VALUES (?, ?, ?, ?)'),
  match_lines: db.prepare('INSERT OR REPLACE INTO match_lines (puuid, id, at, data) VALUES (?, ?, ?, ?)'),
};
const kept = {
  rr_history: db.prepare('SELECT data FROM rr_history WHERE puuid = ? ORDER BY at'),
  match_lines: db.prepare('SELECT data FROM match_lines WHERE puuid = ? ORDER BY at'),
};

export function keepRows(table: keyof typeof keep, puuid: string, rows: { id: string; at: number }[]) {
  db.exec('BEGIN');
  try {
    for (const r of rows) if (r.id && Number.isFinite(r.at)) keep[table].run(puuid, r.id, r.at, JSON.stringify(r));
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** Oldest first. */
export function keptRows<T>(table: keyof typeof keep, puuid: string): T[] {
  return (kept[table].all(puuid) as { data: string }[]).map((r) => JSON.parse(r.data));
}

// ---- analytics: own first-party log, no cookies, no raw IPs ----------------

db.exec(`
  CREATE TABLE IF NOT EXISTS hits (
    at INTEGER NOT NULL, kind TEXT NOT NULL, path TEXT NOT NULL, status INTEGER NOT NULL,
    visitor TEXT NOT NULL, country TEXT, ref TEXT, player TEXT, region TEXT, ms INTEGER
  );
  CREATE INDEX IF NOT EXISTS hits_at ON hits (at);
  CREATE INDEX IF NOT EXISTS hits_player ON hits (player, at);
`);
const qHit = db.prepare('INSERT INTO hits (at, kind, path, status, visitor, country, ref, player, region, ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
const qPrune = db.prepare('DELETE FROM hits WHERE at < ?');
export type Hit = { kind: string; path: string; status: number; visitor: string; country: string | null; ref: string | null; player: string | null; region: string | null; ms: number };
export function logHit(h: Hit) {
  qHit.run(Date.now(), h.kind, h.path, h.status, h.visitor, h.country, h.ref, h.player, h.region, h.ms);
}
export const pruneHits = (days: number) => qPrune.run(Date.now() - days * 86400_000);
export const query = <T>(sql: string, ...args: (string | number)[]) => db.prepare(sql).all(...args) as T[];
