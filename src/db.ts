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
