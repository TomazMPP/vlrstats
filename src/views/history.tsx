// History page: server-rendered SVG charts in the site's monochrome ink.
// Every mark carries data-tip; app.js turns that into the hover tooltip.
import { Img, RiotId, Shell } from './ui.js';
import { ProfileTabs } from './profile.js';
import type { Line } from '../data.js';
import { byHour, byWeekday, dayKey, perDay, records, rolling, type Act, type Bucket, type Month, type Roll, type RrPoint } from '../history.js';
import { fmt, img, profileUrl, ratio, tierName, tierShort } from '../lib.js';

type Props = {
  region: string; name: string; tag: string; card: string; tier: number;
  acts: Act[]; rr: RrPoint[]; lines: Line[]; months: Month[]; warn: boolean;
};

const tz = 'America/Sao_Paulo';
const dShort = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz });
const dMonth = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const dDay = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const day = (ms: number) => dShort.format(ms).replace(/\./g, '').replace(/ de /g, ' ');
const monthLabel = (key: string) => dMonth.format(Date.parse(key + '-15')).replace(/\./g, '').replace(' de ', '/');
const n1 = (v: number) => v.toFixed(1);

const W = 960;

/** Shared frame: recessive grid with labels on the left. */
const Grid = ({ ys, L, R, H }: { ys: { y: number; label: string }[]; L: number; R: number; H: number }) => (
  <g>
    {ys.map((g) => (
      <>
        <line x1={L} x2={W - R} y1={n1(g.y)} y2={n1(g.y)} stroke="var(--line)" />
        {g.y <= H && <text x={L - 10} y={n1(g.y + 4)} text-anchor="end" class="ax">{g.label}</text>}
      </>
    ))}
  </g>
);

// ---- 1. rank per act -----------------------------------------------------------

const ActsChart = ({ acts }: { acts: Act[] }) => {
  const H = 260, L = 70, R = 12, T = 16, B = 30;
  const tiers = acts.flatMap((a) => [a.end, a.peak]).filter((t) => t >= 3);
  const lo = Math.max(3, Math.floor((Math.min(...tiers) - 3) / 3) * 3 + 3);
  const hi = Math.min(27, Math.max(...tiers) + 1);
  const y = (t: number) => T + ((hi - t) / (hi - lo || 1)) * (H - T - B);
  const bw = (W - L - R) / acts.length;
  const x = (i: number) => L + i * bw;
  const fine = hi - lo <= 9;
  const ys = [];
  for (let t = lo; t <= hi; t++) if (fine || (t - 3) % 3 === 0) ys.push({ y: y(t), label: fine ? tierShort(t) : tierName(t).split(' ')[0] });

  let d = '', area = '', open = false, start = 0;
  acts.forEach((a, i) => {
    if (a.end < 3) {
      if (open) area += `V${H - B}H${n1(x(start))}Z`;
      open = false;
      return;
    }
    const yy = n1(y(a.end));
    if (!open) { d += `M${n1(x(i))},${yy}`; area += `M${n1(x(i))},${H - B}V${yy}`; start = i; open = true; }
    else { d += `V${yy}`; area += `V${yy}`; }
    d += `H${n1(x(i + 1))}`; area += `H${n1(x(i + 1))}`;
  });
  if (open) area += `V${H - B}H${n1(x(start))}Z`;
  const every = Math.ceil(acts.length / 16);

  return (
    <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Rank final em ${acts.length} atos`}>
      <Grid ys={ys} L={L} R={R} H={H} />
      <path d={area} fill="var(--fg)" opacity=".06" />
      <path d={d} fill="none" stroke="var(--fg)" stroke-width="2" stroke-linejoin="round" />
      {acts.map((a, i) => a.peak > a.end && a.peak >= 3 && (
        <circle cx={n1(x(i) + bw / 2)} cy={n1(y(a.peak))} r="4" fill="var(--surface)" stroke="var(--fg)" stroke-width="1.6" />
      ))}
      {acts.map((a, i) => i % every === 0 || i === acts.length - 1 ? (
        <text x={n1(x(i) + bw / 2)} y={H - 10} text-anchor="middle" class="ax">{a.short.toUpperCase()}</text>
      ) : null)}
      {acts.map((a, i) => (
        <rect class="hit" x={n1(x(i))} y={T} width={n1(bw)} height={H - T - B}
          data-tip={`${a.short.toUpperCase()}\nFinal: ${a.end >= 3 ? `${tierName(a.end)} · ${a.endRr} RR` : 'Sem rank'}${a.peak >= 3 ? `\nMaior vitória: ${tierName(a.peak)}` : ''}\n${a.games} partidas · ${a.wins}V (${fmt.pct(ratio(a.wins, a.games))})${a.board ? `\nLeaderboard #${fmt.int(a.board)}` : ''}`} />
      ))}
    </svg>
  );
};

// ---- 2. continuous RR ------------------------------------------------------------

const RrChart = ({ rr }: { rr: RrPoint[] }) => {
  const H = 300, L = 70, R = 16, T = 30, B = 24;
  const elos = rr.map((p) => p.elo);
  const lo = Math.floor(Math.min(...elos) / 100) * 100;
  const hi = Math.ceil((Math.max(...elos) + 1) / 100) * 100;
  const y = (e: number) => T + ((hi - e) / (hi - lo || 1)) * (H - T - B);
  const step = (W - L - R) / Math.max(1, rr.length - 1);
  const x = (i: number) => L + i * step;
  const span = (hi - lo) / 100;
  const ys = [];
  for (let e = lo; e <= hi; e += span > 8 ? 300 : 100) ys.push({ y: y(e), label: tierShort(Math.min(27, e / 100 + 3)) });
  const line = rr.map((p, i) => `${i ? 'L' : 'M'}${n1(x(i))},${n1(y(p.elo))}`).join('');
  const peakI = elos.indexOf(Math.max(...elos));
  const peak = rr[peakI];
  let lastLabel = -Infinity;
  const acts = rr.map((p, i) => (i > 0 && p.season !== rr[i - 1].season ? { i, s: p.season, label: false } : null)).filter((v) => v != null)
    .map((a) => { const at = x(a.i); if (at - lastLabel >= 48) { a.label = true; lastLabel = at; } return a; });

  return (
    <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`RR em ${rr.length} partidas ranqueadas`}>
      <Grid ys={ys} L={L} R={R} H={H} />
      {acts.map((a) => (
        <g>
          <line x1={n1(x(a.i) - step / 2)} x2={n1(x(a.i) - step / 2)} y1={T - 12} y2={H - B} stroke="var(--line-strong)" stroke-dasharray="3 3" />
          {a.label && <text x={n1(x(a.i) - step / 2 + 5)} y={T - 4} class="ax">{a.s.toUpperCase()}</text>}
        </g>
      ))}
      <path d={`${line}L${n1(x(rr.length - 1))},${H - B}L${L},${H - B}Z`} fill="var(--fg)" opacity=".06" />
      <path d={line} fill="none" stroke="var(--fg)" stroke-width="2" stroke-linejoin="round" />
      {rr.map((p, i) => p.tier < p.before && p.before >= 3 ? (
        <circle cx={n1(x(i))} cy={n1(y(p.elo))} r="4.5" fill="var(--danger)" stroke="var(--surface)" stroke-width="2" />
      ) : p.tier > p.before && p.before >= 3 ? (
        <circle cx={n1(x(i))} cy={n1(y(p.elo))} r="4" fill="var(--surface)" stroke="var(--fg)" stroke-width="1.6" />
      ) : null)}
      <circle cx={n1(x(peakI))} cy={n1(y(peak.elo))} r="5" fill="var(--fg)" stroke="var(--surface)" stroke-width="2" />
      <text x={n1(Math.min(Math.max(x(peakI), L + 60), W - R - 60))} y={n1(y(peak.elo) - 12)} text-anchor="middle" class="ax strong">
        Pico · {tierShort(peak.tier)} {peak.rr} RR
      </text>
      {rr.map((p, i) => (
        <rect class="hit" x={n1(x(i) - step / 2)} y={T} width={n1(Math.max(step, 2))} height={H - T - B}
          data-tip={`${day(p.at)} · ${p.map}\n${p.placement ? 'Classificatória' : `${fmt.signed(p.change)} RR`} → ${tierName(p.tier)} · ${p.rr} RR${p.tier < p.before ? `\nCaiu de ${tierName(p.before)}` : p.tier > p.before && p.before >= 3 ? `\nSubiu de ${tierName(p.before)}` : ''}${p.prot ? '\nProteção contra rebaixamento' : ''}`} />
      ))}
    </svg>
  );
};

// ---- 3. performance over time --------------------------------------------------------

const Multiple = ({ pts, get, show, title, w }: { pts: Roll[]; get: (r: Roll) => number; show: (v: number) => string; title: string; w: number }) => {
  const SW = 300, H = 132, L = 40, R = 6, T = 10, B = 8;
  const vs = pts.map(get);
  const min = Math.min(...vs), max = Math.max(...vs), pad = (max - min) * 0.08 || max * 0.05 || 1;
  const lo = min - pad, hi = max + pad;
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const step = (SW - L - R) / Math.max(1, pts.length - 1);
  const x = (i: number) => L + i * step;
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${n1(x(i))},${n1(y(get(p)))}`).join('');
  const first = vs[0], last = vs[vs.length - 1];
  return (
    <div class="card pad mult">
      <div class="sh" style="margin:0 0 6px">
        <span style="font-weight:500;font-size:13px">{title}</span>
        <span class="num small"><b style="font-weight:600">{show(last)}</b> <span class="muted">{last >= first ? '↑' : '↓'} de {show(first)}</span></span>
      </div>
      <svg viewBox={`0 0 ${SW} ${H}`} style="width:100%;height:auto;display:block" role="img" aria-label={`${title}, média de ${w} partidas, de ${show(first)} a ${show(last)}`}>
        {[min, (min + max) / 2, max].map((v) => (
          <>
            <line x1={L} x2={SW - R} y1={n1(y(v))} y2={n1(y(v))} stroke="var(--line)" />
            <text x={L - 6} y={n1(y(v) + 3.5)} text-anchor="end" class="ax">{show(v)}</text>
          </>
        ))}
        <path d={path} fill="none" stroke="var(--fg)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
        <circle cx={n1(x(pts.length - 1))} cy={n1(y(last))} r="3.5" fill="var(--fg)" stroke="var(--surface)" stroke-width="1.5" />
        {pts.map((p, i) => (
          <rect class="hit" x={n1(x(i) - step / 2)} y={T} width={n1(Math.max(step, 1.5))} height={H - T - B} data-tip={`${day(p.at)}\n${title}: ${show(get(p))}`} />
        ))}
      </svg>
    </div>
  );
};

const MonthsChart = ({ months }: { months: Month[] }) => {
  const H = 210, L = 40, R = 8, T = 12, B = 26;
  const max = Math.max(...months.map((m) => m.wins + m.losses + m.draws), 1);
  const nice = Math.ceil(max / 10) * 10;
  const y = (v: number) => (v / nice) * (H - T - B);
  const band = (W - L - R) / months.length;
  const bw = Math.min(30, band * 0.62);
  const base = H - B;
  return (
    <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Vitórias e derrotas por mês">
      <defs>
        <pattern id="hatch-m" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="var(--sunken)" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--fg-3)" stroke-width="1.4" />
        </pattern>
      </defs>
      <Grid ys={[0, nice / 2, nice].map((v) => ({ y: base - y(v), label: String(v) }))} L={L} R={R} H={H} />
      {months.map((m, i) => {
        const cx = L + i * band + band / 2;
        const wh = y(m.wins), lh = y(m.losses + m.draws);
        const total = m.wins + m.losses + m.draws;
        return (
          <g>
            {wh > 0 && <rect x={n1(cx - bw / 2)} y={n1(base - wh)} width={n1(bw)} height={n1(wh)} rx="3" fill="var(--fg)" />}
            {lh > 0 && <rect x={n1(cx - bw / 2)} y={n1(base - wh - lh - (wh > 0 ? 2 : 0))} width={n1(bw)} height={n1(lh)} rx="3" fill="url(#hatch-m)" stroke="var(--line-strong)" />}
            <text x={n1(cx)} y={H - 8} text-anchor="middle" class="ax">{monthLabel(m.key)}</text>
            <rect class="hit" x={n1(L + i * band)} y={T} width={n1(band)} height={base - T}
              data-tip={`${monthLabel(m.key)}\n${m.wins}V ${m.losses}D${m.draws ? ` ${m.draws}E` : ''} · ${total} partidas\n${fmt.pct(ratio(m.wins, total))} de vitória`} />
          </g>
        );
      })}
    </svg>
  );
};

// ---- 4. activity --------------------------------------------------------------------

const Calendar = ({ lines }: { lines: Line[] }) => {
  const days = perDay(lines);
  const today = Date.parse(dayKey(Date.now()) + 'T00:00:00Z'); // local midnight as UTC date
  const end = today + (6 - new Date(today).getUTCDay()) * 86400_000; // Saturday of this week
  const start = end - (53 * 7 - 1) * 86400_000;
  const S = 18, C = 14, L = 34, T = 22;
  const cols = 53;
  const levels = [0.22, 0.42, 0.66, 0.92];
  const lvl = (n: number) => (n >= 8 ? 3 : n >= 5 ? 2 : n >= 3 ? 1 : 0);
  const cells = [], heads = [];
  let lastMonth = -1, total = 0, active = 0;
  for (let c = 0; c < cols; c++) {
    const colStart = start + c * 7 * 86400_000;
    const mo = new Date(colStart).getUTCMonth();
    if (mo !== lastMonth && c < cols - 2) { heads.push(<text x={L + c * S} y={13} class="ax">{dMonth.format(colStart).split(' ')[0].replace('.', '')}</text>); }
    lastMonth = mo;
    for (let r = 0; r < 7; r++) {
      const t = colStart + r * 86400_000;
      if (t > today) continue;
      const k = new Date(t).toISOString().slice(0, 10);
      const e = days.get(k);
      if (e) { total += e.games; active++; }
      cells.push(e ? (
        <rect x={L + c * S} y={T + r * S} width={C} height={C} rx="2.5" fill="var(--fg)" fill-opacity={levels[lvl(e.games)]}
          data-tip={`${dDay.format(t).replace('.', '')}\n${e.games} partida${e.games > 1 ? 's' : ''} · ${e.wins}V`} />
      ) : (
        <rect x={L + c * S} y={T + r * S} width={C} height={C} rx="2.5" fill="var(--sunken)" stroke="var(--line)" data-tip={`${dDay.format(t).replace('.', '')}\nSem partidas`} />
      ));
    }
  }
  const CW = L + cols * S, CH = T + 7 * S;
  return (
    <div class="card pad">
      <div class="scroll">
        <svg viewBox={`0 0 ${CW} ${CH}`} style={`width:100%;min-width:${CW * 0.72}px;height:auto;display:block`} role="img" aria-label={`${total} partidas competitivas em ${active} dias no último ano`}>
          {heads}
          {['Seg', 'Qua', 'Sex'].map((d, i) => <text x={0} y={T + (1 + i * 2) * S + 11} class="ax">{d}</text>)}
          {cells}
        </svg>
      </div>
      <div class="hrow small muted num" style="justify-content:space-between;margin-top:12px;flex-wrap:wrap;gap:8px">
        <span>{total} partidas em {active} dias no último ano</span>
        <span class="hrow" style="gap:4px">Menos
          <i class="cal" style="background:var(--sunken);box-shadow:inset 0 0 0 1px var(--line)"></i>
          {levels.map((o) => <i class="cal" style={`background:color-mix(in oklab, var(--fg) ${o * 100}%, transparent)`}></i>)}
          Mais</span>
      </div>
    </div>
  );
};

const Buckets = ({ list, title }: { list: Bucket[]; title: string }) => {
  const ok = list.filter((b) => b.games >= 5);
  const best = ok.length ? ok.reduce((a, b) => (ratio(b.wins, b.games) > ratio(a.wins, a.games) ? b : a)) : null;
  return (
    <div>
      <div class="sh"><h2 style="font-size:15px">{title}</h2>{best && <span class="muted small">melhor: {best.label.split(' ·')[0].toLowerCase()}</span>}</div>
      <div class="card" style="padding:8px 18px">
        {list.map((b) => (
          <div class="mapline wide">
            <span class="ell" style={`font-size:14px;font-weight:${b === best ? 600 : 500}`}>{b.label}</span>
            <div class="bar" role="img" aria-label={`${fmt.pct(ratio(b.wins, b.games))} de vitória`}><i style={`width:${(ratio(b.wins, b.games) * 100).toFixed(1)}%`}></i></div>
            <span class="num" style="font-size:14px;font-weight:600;text-align:right">{b.games ? fmt.pct(ratio(b.wins, b.games)) : '—'}</span>
            <span class="num small muted" style="text-align:right">{b.games} part.</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---- page ------------------------------------------------------------------------------

export const HistoryPage = (s: Props) => {
  const base = profileUrl(s.region, s.name, s.tag);
  const lines = s.lines;
  const roll = rolling(lines);
  const rec = records(lines, s.rr, s.acts);
  const matchUrl = (id: string) => `/m/${s.region}/${id}`;
  const since = Math.min(lines[0]?.started ?? Infinity, s.rr[0]?.at ?? Infinity);

  return (
    <Shell title={`Histórico de ${s.name}#${s.tag}`} region={s.region} head={
      <a href={base} class="hrow" style="text-decoration:none">
        {s.card ? <Img src={img.card(s.card)} class="ag ag-sm" w={28} h={28} /> : <span class="ag ag-sm hatch"></span>}
        <span style="font-weight:500"><RiotId name={s.name} tag={s.tag} /></span>
        <span class="muted small">{tierName(s.tier)}</span>
      </a>
    }>
      <div class="stack" id="hmain">
        <div class="in" style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap">
          <div>
            <h1 class="title">Histórico</h1>
            <p class="sub num" style="margin-top:4px">
              {s.acts.length} atos · {lines.length} partidas competitivas{Number.isFinite(since) ? ` desde ${day(since)}` : ''}
              {s.warn ? ' · dados podem estar desatualizados' : ''}
            </p>
          </div>
          <ProfileTabs base={base} on="history" />
        </div>

        <section class="in" style="--d:60ms">
          <div class="sh"><h2>Recordes</h2></div>
          <div class="grid3">
            <div class="card kpi"><b>{rec.streak ? `${rec.streak.n} vitórias` : '—'}</b><span class="num">Maior sequência{rec.streak ? ` · ${day(rec.streak.at)}` : ''}</span></div>
            {rec.gain ? <a class="card kpi lift" href={matchUrl(rec.gain.id)}><b>{fmt.signed(rec.gain.change)} RR</b><span class="num">Maior ganho · {rec.gain.map} · {day(rec.gain.at)}</span></a>
              : <div class="card kpi"><b>—</b><span>Maior ganho de RR</span></div>}
            {rec.acs ? <a class="card kpi lift" href={matchUrl(rec.acs.id)}><b>{fmt.int(ratio(rec.acs.score, rec.acs.rounds))} ACS</b><span class="num">Melhor partida · {rec.acs.agent} · {rec.acs.map}</span></a>
              : <div class="card kpi"><b>—</b><span>Melhor ACS</span></div>}
            {rec.kills ? <a class="card kpi lift" href={matchUrl(rec.kills.id)}><b>{rec.kills.k} kills</b><span class="num">Mais abates · {rec.kills.k}/{rec.kills.d}/{rec.kills.a} · {rec.kills.map}</span></a>
              : <div class="card kpi"><b>—</b><span>Mais kills</span></div>}
            <div class="card kpi"><b>{rec.act ? rec.act.short.toUpperCase() : '—'}</b><span class="num">Ato mais jogado{rec.act ? ` · ${rec.act.games} partidas · ${fmt.pct(ratio(rec.act.wins, rec.act.games))}` : ''}</span></div>
            <div class="card kpi"><b>{fmt.int(lines.length)}</b><span class="num">Partidas registradas · {s.rr.length} com RR</span></div>
          </div>
        </section>

        <section class="in" style="--d:100ms">
          <div class="sh"><h2>Rank por ato</h2>
            <span class="hrow small muted" style="gap:14px">
              <span class="hrow" style="gap:6px"><i class="lgd-line"></i>Rank final</span>
              <span class="hrow" style="gap:6px"><i class="lgd-dot"></i>Maior rank com vitória</span>
            </span>
          </div>
          {s.acts.length ? <div class="card pad scroll"><ActsChart acts={s.acts} /></div>
            : <div class="card empty">Nenhum ato ranqueado encontrado.</div>}
        </section>

        <section class="in" style="--d:140ms">
          <div class="sh"><h2>Curva de RR</h2>
            <span class="hrow small muted" style="gap:14px">
              <span class="hrow" style="gap:6px"><i class="lgd-dot"></i>Subiu de divisão</span>
              <span class="hrow" style="gap:6px"><i class="lgd-dot bad"></i>Caiu de divisão</span>
            </span>
          </div>
          {s.rr.length > 1 ? <div class="card pad scroll"><RrChart rr={s.rr} /></div>
            : <div class="card empty">Poucas partidas ranqueadas com RR registrado.</div>}
        </section>

        <section class="in" style="--d:180ms">
          <div class="sh"><h2>Evolução do desempenho</h2><span class="muted small">média móvel de {roll.w} partidas</span></div>
          {roll.pts.length > 1 ? (
            <div class="grid3">
              <Multiple pts={roll.pts} get={(r) => r.kd} show={fmt.two} title="K/D" w={roll.w} />
              <Multiple pts={roll.pts} get={(r) => r.acs} show={fmt.int} title="ACS" w={roll.w} />
              <Multiple pts={roll.pts} get={(r) => r.hs} show={fmt.pct} title="Headshot" w={roll.w} />
            </div>
          ) : <div class="card empty">Poucas partidas para a média móvel.</div>}
        </section>

        <section class="in" style="--d:200ms">
          <div class="sh"><h2>Vitórias por mês</h2>
            <span class="hrow small muted" style="gap:14px">
              <span class="hrow" style="gap:6px"><i class="lgd" style="background:var(--fg)"></i>Vitórias</span>
              <span class="hrow" style="gap:6px"><i class="lgd hatch"></i>Derrotas</span>
            </span>
          </div>
          {s.months.length ? <div class="card pad scroll"><MonthsChart months={s.months} /></div>
            : <div class="card empty">Nenhuma partida competitiva registrada.</div>}
        </section>

        <section class="in" style="--d:220ms">
          <div class="sh"><h2>Atividade</h2><span class="muted small">partidas competitivas por dia</span></div>
          <Calendar lines={lines} />
        </section>

        {lines.length > 0 && (
          <div class="two in" style="--d:240ms">
            <Buckets list={byWeekday(lines)} title="Dia da semana" />
            <Buckets list={byHour(lines)} title="Horário" />
          </div>
        )}
      </div>
    </Shell>
  );
};
