// Riot's Performance Score: labels, the per-part breakdown and the "seu desempenho" card.
import type { CPlayer, Perf } from '../data.js';
import { fmt } from '../lib.js';

export const GRADE: Record<string, string> = { distinction: 'Destaque', merit: 'Mérito', pass: 'Regular', fail: 'Abaixo' };

/** Breakdown parts in display order: rating key → breakdown key, label. */
const PARTS: [rating: string, part: string, label: string][] = [
  ['kill_impact', 'adjusted_kills', 'Impacto dos abates'],
  ['death_impact', 'adjusted_deaths', 'Impacto das mortes'],
  ['damage', 'damage', 'Dano'],
  ['trades', 'trades', 'Trocas'],
  ['assists', 'assists', 'Assistências'],
  ['utility_usage', 'utility_usage', 'Uso de utilitária'],
  ['plants', 'plants', 'Plants'],
  ['defuses', 'defuses', 'Defuses'],
];
const ARROW: Record<string, string> = { double_up: '↑↑', up: '↑', neutral: '–', down: '↓', double_down: '↓↓' };
const ARROW_PT: Record<string, string> = { double_up: 'muito bom', up: 'bom', neutral: 'neutro', down: 'fraco', double_down: 'muito fraco' };

const partValue = (key: string, v: number | null | undefined) =>
  v == null ? '—' : key === 'damage' ? fmt.int(v) : fmt.two(v);

/** Tooltip text for a scoreboard cell (first line is the title). */
export const psTip = (p: CPlayer) => {
  const f = p.perf;
  if (!f) return undefined;
  const lines = PARTS.filter(([r]) => f.ratings[r] && f.ratings[r] !== 'neutral').map(([r, , label]) => `${ARROW[f.ratings[r]]} ${label}`);
  return [`Performance Score ${fmt.int(f.score)} · ${GRADE[f.grade] ?? f.grade}`, ...lines].join('\n');
};

export const Crown = ({ size = 14 }: { size?: number }) => (
  <svg class="crown" width={size} height={size} viewBox="0 0 20 20" fill="currentColor" role="img" aria-label="MVP da partida">
    <title>MVP da partida</title>
    <path d="M3 6.5l3.8 3L10 4l3.2 5.5L17 6.5l-1.4 8H4.4z" /><rect x="4.4" y="15.6" width="11.2" height="1.8" rx=".9" />
  </svg>
);

/** The player's own breakdown, with Riot's up/down ratings per part. */
export const PerfCard = ({ f, rank, of, mvp }: { f: Perf; rank: number; of: number; mvp: boolean }) => (
  <section class="in" style="--d:60ms">
    <div class="sh"><h2>Seu Performance Score</h2><span class="muted small">a nota que a Riot mostra no placar</span></div>
    <div class="card perf">
      <div class="perf-total">
        <b class="num">{fmt.int(f.score)}</b>
        <span class="hrow" style="gap:6px">
          <span class={`tag ${f.grade === 'distinction' || f.grade === 'merit' ? 'ink' : 'out'}`}>{GRADE[f.grade] ?? f.grade}</span>
          {mvp && <span class="tag out hrow" style="gap:4px"><Crown size={12} />MVP</span>}
        </span>
        <span class="small muted num">{rank}º de {of} na partida</span>
      </div>
      <div class="perf-parts">
        {PARTS.map(([r, k, label]) => {
          const rt = f.ratings[r] ?? 'neutral';
          return (
            <div class="perf-part">
              <span class={`arw ${rt}`} aria-label={ARROW_PT[rt] ?? rt} title={ARROW_PT[rt] ?? rt}>{ARROW[rt] ?? '–'}</span>
              <span>{label}</span>
              <span class="num muted" title="por round">{partValue(k, f.parts[k])}</span>
            </div>
          );
        })}
      </div>
    </div>
    <p class="small muted" style="margin-top:10px">Setas: a avaliação da Riot para cada parte do seu jogo. Valores por round.</p>
  </section>
);
