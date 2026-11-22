import { Img, RiotId, Shell } from './ui.js';
import { ProfileTabs } from './profile.js';
import { groupBy, totals, type Line, type WL, type sidesByMap, type weaponsAndSides } from '../data.js';
import { fmt, img, profileUrl, ratio, tierName } from '../lib.js';

const since = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });

export type Period = '20' | '50' | 'act' | 'all';
export const PERIODS: Record<Period, string> = { '20': '20', '50': '50', act: 'Ato', all: 'Tudo' };

type Props = {
  region: string; name: string; tag: string; card: string; tier: number;
  lines: Line[]; period: Period; season: string; detail: ReturnType<typeof weaponsAndSides>;
  sides: ReturnType<typeof sidesByMap>; warn: boolean;
};

/** Rounds won out of played, the percentage last so the column lines up on it. */
const WinCell = ({ wl, strong }: { wl: WL; strong?: boolean }) => (
  <td>{wl[1] ? <><span class="small muted">{wl[0]} / {wl[1]}</span>{' '}<span style={strong ? 'font-weight:600' : undefined}>{fmt.pct(ratio(wl[0], wl[1]))}</span></> : <span class="muted">—</span>}</td>
);

export const StatsPage = (s: Props) => {
  const base = profileUrl(s.region, s.name, s.tag);
  const t = totals(s.lines);
  const agents = groupBy(s.lines, 'agent');
  const maps = groupBy(s.lines, 'map').sort((a, b) => b.winRate - a.winRate || b.games - a.games);
  // agent win rate on each map, maps by games played
  const byMap = groupBy(s.lines, 'map').sort((a, b) => b.games - a.games).map((m) => ({
    ...m, agents: groupBy(s.lines.filter((l) => l.map === m.name), 'agent').sort((a, b) => b.games - a.games || b.winRate - a.winRate),
  }));
  const { weapons, atk, def } = s.detail;
  const topKills = weapons[0]?.kills ?? 0;
  const totalKills = weapons.reduce((n, w) => n + w.kills, 0);

  return (
    <Shell title={`Estatísticas de ${s.name}#${s.tag}`} region={s.region} head={
      <a href={base} class="hrow" style="text-decoration:none">
        {s.card ? <Img src={img.card(s.card)} class="ag ag-sm" w={28} h={28} /> : <span class="ag ag-sm hatch"></span>}
        <span style="font-weight:500"><RiotId name={s.name} tag={s.tag} /></span>
        <span class="muted small">{tierName(s.tier)}</span>
      </a>
    }>
      <div class="stack" id="smain">
        <div class="in" style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap">
          <div>
            <h1 class="title">Estatísticas</h1>
            <p class="sub num" style="margin-top:4px">
              Competitivo · {fmt.int(t.games)} partidas{s.period === 'act' && s.season ? ` · ${s.season.toUpperCase()}` : ''}{s.period === 'all' && s.lines.length ? ` · desde ${since.format(s.lines[s.lines.length - 1].started).replace(/\./g, "").replace(/ de /g, " ")}` : ''}
              {s.warn ? ' · dados podem estar desatualizados' : ''}
            </p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <ProfileTabs base={base} on="stats" />
            <nav class="tabs" aria-label="Período">
              {(Object.keys(PERIODS) as Period[]).map((p) => (
                <a class={`tab${p === s.period ? ' on' : ''}`} href={`${base}/stats${p === '50' ? '' : `?period=${p}`}`} data-swap="#smain" aria-current={p === s.period ? 'true' : undefined}>{PERIODS[p]}</a>
              ))}
            </nav>
          </div>
        </div>

        {!t.games ? <div class="card empty in">Nenhuma partida competitiva encontrada.</div> : (
          <>
            <section class="in" style="--d:80ms">
              <div class="sh"><h2>Agentes</h2><span class="muted num small">{agents.length} agentes</span></div>
              <div class="card scroll">
                <table style="min-width:640px">
                  <thead><tr><th>Agente</th><th>Partidas</th><th>Vitórias</th><th>K/D</th><th>KDA</th><th>ACS</th><th>ADR</th><th>HS</th></tr></thead>
                  <tbody>
                    {agents.map((a) => (
                      <tr>
                        <td><span class="hrow"><Img src={img.agent(a.id)} class="ag" w={32} h={32} /><span style="font-weight:500">{a.name}</span></span></td>
                        <td>{a.games}</td><td style="font-weight:500">{fmt.pct(a.winRate)}</td><td>{fmt.two(a.kd)}</td><td>{fmt.two(a.kda)}</td>
                        <td>{fmt.int(a.acs)}</td><td>{fmt.int(a.adr)}</td><td class="muted">{fmt.pct(a.hsRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div class="two in" style="--d:140ms">
              <section>
                <div class="sh"><h2>Mapas</h2><span class="muted small">% de vitória</span></div>
                <div class="card" style="padding:8px 18px">
                  {maps.map((m) => (
                    <div class="mapline">
                      <span class="ell" style="font-weight:500;font-size:14px">{m.name}</span>
                      <div class="bar" role="img" aria-label={`${fmt.pct(m.winRate)} de vitória`}><i style={`width:${(m.winRate * 100).toFixed(1)}%`}></i></div>
                      <span class="num" style="font-size:14px;font-weight:600;text-align:right">{fmt.pct(m.winRate)}</span>
                      <span class="num small muted" style="text-align:right">{m.wins}V {m.losses}D</span>
                    </div>
                  ))}
                </div>
              </section>

              <section style="display:flex;flex-direction:column;gap:40px">
                <div>
                  <div class="sh"><h2>Precisão</h2><span class="muted num small">{fmt.int(t.shots)} acertos</span></div>
                  <div class="card pad" style="display:flex;flex-direction:column;gap:14px">
                    <div class="acc" role="img" aria-label={`Cabeça ${fmt.pct1(t.hsRate)}, corpo ${fmt.pct1(t.bodyRate)}, perna ${fmt.pct1(t.legRate)}`}>
                      <span style={`width:${t.hsRate * 100}%;background:var(--fg)`}></span>
                      <span class="hatch" style={`width:${t.bodyRate * 100}%;box-shadow:none`}></span>
                      <span style={`width:${t.legRate * 100}%;background:var(--sunken)`}></span>
                    </div>
                    <div class="num" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;font-size:13px">
                      <div><span class="lgd" style="background:var(--fg)"></span>Cabeça <b style="font-weight:600">{fmt.pct1(t.hsRate)}</b></div>
                      <div><span class="lgd hatch"></span>Corpo <b style="font-weight:600">{fmt.pct1(t.bodyRate)}</b></div>
                      <div><span class="lgd" style="background:var(--sunken);box-shadow:inset 0 0 0 1px var(--line-strong)"></span>Perna <b style="font-weight:600">{fmt.pct1(t.legRate)}</b></div>
                    </div>
                  </div>
                </div>

                <div>
                  <div class="sh"><h2>Por lado</h2><span class="muted small">rounds vencidos · {s.detail.matches} partidas</span></div>
                  {atk[1] + def[1] > 0 ? (
                    <div class="grid2">
                      <div class="card kpi"><b>{fmt.pct(ratio(atk[0], atk[1]))}</b><span class="num">Ataque · {atk[0]} / {atk[1]}</span></div>
                      <div class="card kpi"><b>{fmt.pct(ratio(def[0], def[1]))}</b><span class="num">Defesa · {def[0]} / {def[1]}</span></div>
                    </div>
                  ) : <div class="card empty">Abra o perfil para carregar partidas detalhadas.</div>}
                </div>
              </section>
            </div>

            {s.sides.length > 0 && (
              <section class="in" style="--d:155ms">
                <div class="sh"><h2>Lado por mapa</h2><span class="muted small">rounds vencidos · menos de 3 partidas em cinza</span></div>
                <div class="card scroll">
                  <table style="min-width:520px">
                    <thead><tr><th>Mapa</th><th>Partidas</th><th>Ataque</th><th>Defesa</th></tr></thead>
                    <tbody>
                      {s.sides.map((m) => {
                        const a = ratio(m.atk[0], m.atk[1]), d = ratio(m.def[0], m.def[1]);
                        return (
                          <tr class={m.games < 3 ? 'muted' : undefined} title={m.games < 3 ? 'Amostra pequena' : undefined}>
                            <td style="font-weight:500">{m.name}</td>
                            <td>{m.games}</td>
                            <WinCell wl={m.atk} strong={a > d} />
                            <WinCell wl={m.def} strong={d > a} />
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section class="in" style="--d:170ms">
              <div class="sh"><h2>Agentes por mapa</h2><span class="muted small">% de vitória · menos de 3 partidas em cinza</span></div>
              <div class="amaps">
                {byMap.map((m) => (
                  <div class="card clip amap">
                    <div class="amap-head">
                      {m.id ? <Img src={img.map(m.id)} class="amap-img" w={456} h={100} /> : <span class="amap-img hatch"></span>}
                      <span class="amap-title">
                        <b>{m.name}</b>
                        <span class="num">{fmt.pct(m.winRate)} · {m.wins}V {m.losses}D</span>
                      </span>
                    </div>
                    <div class="amap-list">
                      {m.agents.map((a) => (
                        <div class={`amap-row${a.games < 3 ? ' few' : ''}`} title={a.games < 3 ? 'Amostra pequena' : undefined}>
                          <span class="hrow" style="gap:8px;min-width:0"><Img src={img.agent(a.id)} class="ag ag-sm" w={24} h={24} /><span class="ell">{a.name}</span></span>
                          <span class="num small muted">{a.wins}V {a.losses}D</span>
                          <span class="num amap-pct">{fmt.pct(a.winRate)}</span>
                          <div class="bar" role="img" aria-label={`${fmt.pct(a.winRate)} de vitória em ${a.games} partidas`}><i style={`width:${(a.winRate * 100).toFixed(1)}%`}></i></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {weapons.length > 0 && (
              <section class="in" style="--d:200ms">
                <div class="sh"><h2>Armas</h2><span class="muted small">abates · {s.detail.matches} partidas detalhadas</span></div>
                <div class="card scroll">
                  <table style="min-width:520px">
                    <thead><tr><th>Arma</th><th style="width:45%"></th><th>Abates</th><th>% dos abates</th></tr></thead>
                    <tbody>
                      {weapons.slice(0, 10).map((w) => (
                        <tr>
                          <td style="font-weight:500">{w.name}</td>
                          <td><div class="bar"><i style={`width:${ratio(w.kills, topKills) * 100}%`}></i></div></td>
                          <td>{w.kills}</td><td class="muted">{fmt.pct(ratio(w.kills, totalKills))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </Shell>
  );
};
