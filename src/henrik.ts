// Thin HenrikDev API client: auth, timeout, rate-limit tracking, in-flight dedupe.

const API = 'https://api.henrikdev.xyz';
const KEY = process.env.HENRIK_API_KEY?.trim() ?? '';
if (!KEY) console.warn('[henrik] HENRIK_API_KEY is not set — requests will be rejected');

export class ApiError extends Error {
  constructor(public status: number, message: string, public retryAfter = 0) {
    super(message);
  }
}

// Mirror of the key's per-minute bucket, from response headers.
let remaining = 30;
let resetAt = 0;
const inflight = new Map<string, Promise<unknown>>();

export function henrik<T>(path: string): Promise<T> {
  const hit = inflight.get(path);
  if (hit) return hit as Promise<T>;
  const p = request<T>(path).finally(() => inflight.delete(path));
  inflight.set(path, p);
  return p;
}

async function request<T>(path: string): Promise<T> {
  const now = Date.now();
  if (remaining <= 0 && now < resetAt) {
    throw new ApiError(429, 'rate limited (local)', Math.ceil((resetAt - now) / 1000));
  }
  let res: Response;
  try {
    res = await fetch(API + path, {
      headers: { Authorization: KEY, Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
  } catch (e) {
    throw new ApiError(503, `network: ${(e as Error).message}`);
  }

  const rem = Number(res.headers.get('x-ratelimit-remaining'));
  const reset = Number(res.headers.get('x-ratelimit-reset'));
  if (res.headers.has('x-ratelimit-remaining') && Number.isFinite(rem)) remaining = rem;
  if (res.headers.has('x-ratelimit-reset') && Number.isFinite(reset)) resetAt = Date.now() + reset * 1000;

  if (res.status === 429) {
    remaining = 0;
    const wait = Number(res.headers.get('retry-after')) || reset || 60;
    resetAt = Date.now() + wait * 1000;
    throw new ApiError(429, 'rate limited', wait);
  }
  if (res.status === 404) throw new ApiError(404, `not found: ${path}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status, `HTTP ${res.status} ${path} ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}
