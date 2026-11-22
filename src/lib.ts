// Shared helpers: rank names, image URLs and pt-BR formatting.

const DIVISIONS = ['Ferro', 'Bronze', 'Prata', 'Ouro', 'Platina', 'Diamante', 'Ascendente', 'Imortal'];

/** Riot competitive tier id (0–27) → pt-BR name. */
export function tierName(tier: number | null | undefined): string {
  if (!tier || tier < 3) return 'Sem rank';
  if (tier >= 27) return 'Radiante';
  const i = Math.floor((tier - 3) / 3);
  return `${DIVISIONS[i]} ${((tier - 3) % 3) + 1}`;
}

/** Short form for tight spots: "Asc 2". */
export function tierShort(tier: number | null | undefined): string {
  const n = tierName(tier);
  if (n === 'Sem rank' || n === 'Radiante') return n;
  const [d, x] = n.split(' ');
  return `${d.slice(0, 3)} ${x}`;
}

const MEDIA = 'https://media.valorant-api.com';
const TIERSET = '03621f52-342b-cf4e-4f86-9350a49c6d04';
export const img = {
  rank: (tier: number) => `${MEDIA}/competitivetiers/${TIERSET}/${tier}/smallicon.png`,
  agent: (id: string) => `${MEDIA}/agents/${id.toLowerCase()}/minimapportrait.png`,
  card: (id: string) => `${MEDIA}/playercards/${id.toLowerCase()}/smallart.png`,
  map: (id: string) => `${MEDIA}/maps/${id.toLowerCase()}/listviewicon.png`,
};

export const REGIONS = ['br', 'latam', 'na', 'eu', 'ap', 'kr'] as const;
export type Region = (typeof REGIONS)[number];
export const isRegion = (r: string): r is Region => (REGIONS as readonly string[]).includes(r);
/** Riot shard: BR and LATAM accounts live on the NA shard, so the API reports them as "na". */
export const shardOf = (r: Region) => (r === 'br' || r === 'latam' ? 'na' : r);

export const QUEUES = { competitive: 'Competitivo', unrated: 'Sem rank', swiftplay: 'Swiftplay', deathmatch: 'Mata-mata', hurm: 'TDM', all: 'Todas' } as const;
/** HenrikDev's `mode` filter when it differs from the stored queue id. */
export const QUEUE_MODE: Partial<Record<string, string>> = { hurm: 'teamdeathmatch' };
export type Queue = keyof typeof QUEUES;
export const isQueue = (q: string | undefined): q is Queue => !!q && q in QUEUES;

const nf1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
export const fmt = {
  int: (n: number) => nf0.format(n),
  one: (n: number) => nf1.format(n),
  two: (n: number) => nf2.format(n),
  pct: (n: number) => `${nf0.format(n * 100)}%`,
  pct1: (n: number) => `${nf1.format(n * 100)}%`,
  signed: (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0'),
};

export const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
export function ago(ms: number, now = Date.now()): string {
  const s = Math.round((ms - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 60) return 'agora';
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 3600 * 22) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400) || Math.sign(s), 'day');
  return rtf.format(Math.round(s / (86400 * 30)), 'month');
}

const dtf = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
});
export const dateTime = (ms: number) => dtf.format(ms).replace('.', '');
export const minutes = (ms: number) => `${Math.round(ms / 60000)} min`;

/** Encode one Riot ID path segment (names can contain spaces/unicode). */
export const seg = (s: string) => encodeURIComponent(s);
export const profileUrl = (region: string, name: string, tag: string) => `/p/${region}/${seg(name)}/${seg(tag)}`;
