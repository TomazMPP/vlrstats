import { Layout, Logo, ThemeToggle } from './ui.js';
import type { Report } from '../analytics.js';
import { ago, fmt, profileUrl, ratio } from '../lib.js';

const KINDS: Record<string, string> = {
  home: 'Início', search: 'Busca', profile: 'Perfil', stats: 'Estatísticas', history: 'Histórico', match: 'Partida', refresh: 'Atualizar',
  'profile·aba': 'Perfil (troca de aba)', 'stats·aba': 'Estatísticas (troca de aba)', compare: 'Comparar',
};
const PERIODS = [1, 7, 30, 90];

const Daily = ({ rows }: { rows: Report['daily'] }) => {
  if (!rows.length) return <div class="card empty">Sem acessos ainda.</div>;
  const W = 960, H = 180, L = 36, R = 8, T = 10, B = 24;
  const max = Math.max(...rows.map((r) => r.views), 1);
  const nice = Math.max(4, Math.ceil(max / 4) * 4);
  const band = (W - L - R) / rows.length;
  const bw = Math.min(26, band * 0.62);
  const h = (v: number) => (v / nice) * (H - T - B);
  const base = H - B;
  const every = Math.ceil(rows.length / 12);
  return (
    <div class="card pad scroll">
      <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Acessos por dia">
        {[0, nice / 2, nice].map((v) => (
          <>
            <line x1={L} x2={W - R} y1={base - h(v)} y2={base - h(v)} stroke="var(--line)" />
            <text x={L - 8} y={base - h(v) + 4} text-anchor="end" class="ax">{v}</text>
          </>
        ))}
        {rows.map((r, i) => {
          const cx = L + i * band + band / 2;
          return (
            <g>
              <rect x={(cx - bw / 2).toFixed(1)} y={(base - h(r.views)).toFixed(1)} width={bw.toFixed(1)} height={h(r.views).toFixed(1)} rx="3" fill="var(--fg)" fill-opacity=".22" />
              <rect x={(cx - bw / 2).toFixed(1)} y={(base - h(r.visitors)).toFixed(1)} width={bw.toFixed(1)} height={h(r.visitors).toFixed(1)} rx="3" fill="var(--fg)" />
              {(i % every === 0 || i === rows.length - 1) && <text x={cx.toFixed(1)} y={H - 6} text-anchor="middle" class="ax">{r.day.slice(8)}/{r.day.slice(5, 7)}</text>}
              <rect class="hit" x={(L + i * band).toFixed(1)} y={T} width={band.toFixed(1)} height={base - T}
                data-tip={`${r.day.slice(8)}/${r.day.slice(5, 7)}\n${r.visitors} visitantes · ${r.views} páginas`} />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const Table = ({ head, rows, empty }: { head: string[]; rows: unknown[][]; empty: string }) => rows.length ? (
  <div class="card scroll">
    <table>
      <thead><tr>{head.map((h) => <th>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r) => <tr>{r.map((c) => <td>{c}</td>)}</tr>)}</tbody>
    </table>
  </div>
) : <div class="card empty">{empty}</div>;

const Step = ({ label, n, of, note }: { label: string; n: number; of: number; note?: string }) => (
  <div class="fun-step">
    <span class="hrow" style="justify-content:space-between;gap:12px">
      <span>{label}</span>
      <span class="num"><b>{fmt.int(n)}</b> <span class="muted small">{fmt.pct(ratio(n, of))}</span></span>
    </span>
    <span class="cmp-bar" aria-hidden="true" style="max-width:none"><i style={`width:${(ratio(n, of) * 100).toFixed(1)}%`}></i></span>
    {note && <span class="small muted">{note}</span>}
  </div>
);

export const AdminPage = ({ r }: { r: Report }) => {
  const fu = r.funnel, re = r.retention;
  const k = r.period, t = r.today;
  return (
    <Layout title="Analytics" noindex>
      <div class="wrap page">
        <header class="top">
          <a class="brand" href="/"><Logo />vlrstats</a>
          <div class="hrow" style="gap:8px"><ThemeToggle /></div>
        </header>
        <div class="stack">
          <div class="in" style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap">
            <div>
              <h1 class="title">Analytics</h1>
              <p class="sub">Sem cookies; visitante = hash diário de IP + navegador. Robôs ignorados.</p>
            </div>
            <nav class="tabs" aria-label="Período">
              {PERIODS.map((d) => <a class={`tab${d === r.days ? ' on' : ''}`} href={`/admin?d=${d}`}>{d === 1 ? 'Hoje' : `${d} dias`}</a>)}
            </nav>
          </div>

          <section class="in">
            <div class="grid3">
              <div class="card kpi"><b>{fmt.int(k.visitors)}</b><span class="num">Visitantes · hoje {t.visitors}</span></div>
              <div class="card kpi"><b>{fmt.int(k.views)}</b><span class="num">Páginas vistas · hoje {t.views}</span></div>
              <div class="card kpi"><b>{fmt.int(k.players)}</b><span class="num">Jogadores consultados · hoje {t.players}</span></div>
              <div class="card kpi"><b>{fmt.int(k.searches ?? 0)}</b><span class="num">Buscas · {fmt.pct(ratio(k.misses ?? 0, k.searches ?? 0))} sem resultado</span></div>
              <div class="card kpi"><b>{fmt.one(ratio(k.views, k.visitors))}</b><span>Páginas por visitante</span></div>
              <div class="card kpi"><b>{r.errors.reduce((n, e) => n + e.n, 0)}</b><span>Erros 5xx no período</span></div>
            </div>
          </section>

          <section class="in" style="--d:60ms">
            <div class="sh"><h2>Por dia</h2>
              <span class="hrow small muted" style="gap:14px">
                <span class="hrow" style="gap:6px"><i class="lgd" style="background:var(--fg)"></i>Visitantes</span>
                <span class="hrow" style="gap:6px"><i class="lgd" style="background:color-mix(in oklab, var(--fg) 22%, transparent)"></i>Páginas</span>
              </span>
            </div>
            <Daily rows={r.daily} />
          </section>

          <div class="two in" style="--d:80ms">
            <section>
              <div class="sh"><h2>Funil</h2><span class="muted small">visitantes por dia, % do total</span></div>
              <div class="card pad fun">
                <Step label="Chegaram" n={fu.visitors ?? 0} of={fu.visitors ?? 0} />
                <Step label="Buscaram" n={fu.searched ?? 0} of={fu.visitors ?? 0} />
                <Step label="Abriram um perfil" n={fu.profile ?? 0} of={fu.visitors ?? 0}
                  note={`${fmt.pct(ratio(fu.searchToProfile ?? 0, fu.searched ?? 0))} de quem buscou`} />
                <Step label="Foram além (histórico, estatísticas, partida, comparar)" n={fu.deep ?? 0} of={fu.visitors ?? 0}
                  note={`${fmt.pct(ratio(fu.profileToDeep ?? 0, fu.profile ?? 0))} de quem abriu um perfil`} />
              </div>
            </section>
            <section>
              <div class="sh"><h2>Retenção</h2><span class="muted small">por jogador, últimos {Math.max(r.days, 30)} dias</span></div>
              <div class="grid2">
                <div class="card kpi"><b>{re.base1 ? fmt.pct(ratio(re.d1 ?? 0, re.base1)) : '—'}</b><span class="num">Voltaram no dia seguinte · {fmt.int(re.d1 ?? 0)} de {fmt.int(re.base1 ?? 0)}</span></div>
                <div class="card kpi"><b>{re.base7 ? fmt.pct(ratio(re.d7 ?? 0, re.base7)) : '—'}</b><span class="num">Voltaram em até 7 dias · {fmt.int(re.d7 ?? 0)} de {fmt.int(re.base7 ?? 0)}</span></div>
              </div>
              <p class="small muted" style="margin-top:10px">Um perfil visto num dia e visto de novo depois. O visitante muda de hash todo dia (privacidade), então a retenção é medida pelo jogador consultado, não pela pessoa.</p>
            </section>
          </div>

          <div class="two in" style="--d:100ms">
            <section>
              <div class="sh"><h2>Jogadores mais vistos</h2><span class="muted small">{r.players.length}</span></div>
              <Table head={['Jogador', 'Views', 'Pessoas', 'Último']} empty="Nenhum perfil aberto no período."
                rows={r.players.map((p) => {
                  const [n, tag] = p.player.split('#');
                  return [<a href={profileUrl(p.region, n, tag ?? '')} translate="no" style="font-weight:500">{p.player} <span class="muted small">{p.region.toUpperCase()}</span></a>, p.views, p.visitors, <span class="muted">{ago(p.last)}</span>];
                })} />
            </section>
            <section>
              <div class="sh"><h2>Buscas recentes</h2></div>
              <Table head={['Busca', 'Resultado', 'País', 'Quando']} empty="Nenhuma busca ainda."
                rows={r.searches.map((s) => [
                  <span translate="no" style="font-weight:500">{s.player}</span>,
                  s.status === 404 ? <span class="muted">não achou</span> : s.status >= 500 || s.status === 429 ? <span class="muted">erro {s.status}</span> : 'ok',
                  s.country ?? '—', <span class="muted">{ago(s.at)}</span>,
                ])} />
            </section>
          </div>

          <div class="grid3 in" style="--d:140ms;align-items:start">
            <section>
              <div class="sh"><h2>Páginas</h2></div>
              <Table head={['Tipo', 'Views', 'ms']} empty="—" rows={r.kinds.map((x) => [KINDS[x.kind] ?? x.kind, x.views, <span class="muted">{x.ms}</span>])} />
            </section>
            <section>
              <div class="sh"><h2>Origem</h2></div>
              <Table head={['Site', 'Views']} empty="Só acesso direto." rows={r.refs.map((x) => [x.ref, x.views])} />
            </section>
            <section>
              <div class="sh"><h2>Países</h2></div>
              <Table head={['País', 'Pessoas']} empty="—" rows={r.countries.map((x) => [x.country, x.visitors])} />
            </section>
          </div>

          {r.errors.length > 0 && (
            <section class="in">
              <div class="sh"><h2>Erros</h2></div>
              <Table head={['Página', 'Status', 'Vezes', 'Último']} empty="" rows={r.errors.map((e) => [<span class="ell" translate="no">{e.path}</span>, e.status, e.n, ago(e.last)])} />
            </section>
          )}

          <section class="in">
            <div class="sh"><h2>Últimos acessos</h2></div>
            <Table head={['Quando', 'Tipo', 'Página', 'Status', 'País', 'ms']} empty="Sem acessos ainda."
              rows={r.recent.map((x) => [<span class="muted">{ago(x.at)}</span>, KINDS[x.kind] ?? x.kind, <span translate="no" class="small">{decodeURIComponentSafe(x.path)}</span>, x.status, x.country ?? '—', x.ms])} />
          </section>
        </div>
      </div>
    </Layout>
  );
};

function decodeURIComponentSafe(s: string) {
  try { return decodeURIComponent(s); } catch { return s; }
}
