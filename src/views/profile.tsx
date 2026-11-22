import { Icon, Img, RiotId, Shell } from './ui.js';
import { groupBy, isFfa, lineOf, noRounds, placeOf, totals, type Line, type Profile } from '../data.js';
import type { RrPoint } from '../history.js';
import { Crown } from './perf.js';
import { SocialSection } from './social.js';
import type { Social } from '../social.js';
import { QUEUES, ago, fmt, img, profileUrl, tierName, tierShort, type Queue } from '../lib.js';

export const ProfileTabs = ({ base, on }: { base: string; on: 'overview' | 'stats' | 'history' }) => (
  <nav class="tabs" aria-label="Seções do perfil">
    <a class={`tab${on === 'overview' ? ' on' : ''}`} href={base} aria-current={on === 'overview' ? 'page' : undefined}>Visão geral</a>
    <a class="tab" href={`${base}#partidas`}>Partidas</a>
    <a class={`tab${on === 'stats' ? ' on' : ''}`} href={`${base}/stats`} aria-current={on === 'stats' ? 'page' : undefined}>Estatísticas</a>
    <a class={`tab${on === 'history' ? ' on' : ''}`} href={`${base}/history`} aria-current={on === 'history' ? 'page' : undefined}>Histórico</a>
  </nav>
);

/** RR won or lost in a match; a division change shows the new rank. */
const RrDelta = ({ p }: { p: RrPoint }) => {
  const moved = p.before >= 3 && p.tier !== p.before;
  const label = p.placement ? 'Classificatória' : `${fmt.signed(p.change)} RR · ${tierName(p.tier)} ${p.rr} RR${moved ? (p.tier > p.before ? ' · subiu de divisão' : ' · caiu de divisão') : ''}${p.prot ? ' · proteção contra rebaixamento' : ''}`;
  return (
    <span class={`rrd${p.change > 0 ? ' up' : p.change < 0 ? ' down' : ''}${moved && p.tier < p.before ? ' drop' : ''}`} title={label} aria-label={label}>
      {moved && <Img src={img.rank(p.tier)} class="rk-xs" w={16} h={16} />}
      {p.placement ? 'Clas.' : fmt.signed(p.change)}
    </span>
  );
};

const Sparkline = ({ elos }: { elos: number[] }) => {
  if (elos.length < 2) return <p class="small muted">Poucas partidas ranqueadas para o gráfico.</p>;
  const min = Math.min(...elos), max = Math.max(...elos), span = max - min || 1;
  const pts = elos.map((v, i) => `${((i * 260) / (elos.length - 1)).toFixed(1)},${(58 - ((v - min) / span) * 52).toFixed(1)}`).join(' ');
  return (
    <svg class="spark" viewBox="0 0 260 64" width="100%" height="64" preserveAspectRatio="none" role="img"
      aria-label={`Evolução do RR nas últimas ${elos.length} partidas`}>
      <polyline points={pts} fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
    </svg>
  );
};

const histLabel = (h: { tier: { id: number }; rr: number }) => `${tierShort(h.tier.id)} · ${h.rr}`;

const MmrCard = ({ p }: { p: Profile }) => {
  const { avgTier, games, avgGain, avgLoss } = p.lobby;
  const cur = p.mmr?.current.tier.id ?? 0;
  if (avgTier == null && avgGain == null) return null;
  const est = avgTier != null ? Math.round(avgTier) : null;
  const diff = avgTier != null && cur >= 3 && cur < 27 ? avgTier - cur : null;
  const verdict = diff == null ? null
    : diff >= 0.67 ? 'Acima' : diff <= -0.67 ? 'Abaixo' : 'Igual';
  return (
    <div class="card pad" style="display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
        <span style="font-size:14px;font-weight:600">MMR estimado</span>
        <span class="small muted" title="A Riot não mostra o MMR. Estimamos pela média de rank dos outros 9 jogadores das suas partidas: o matchmaking monta lobbies em volta do MMR.">como calculamos</span>
      </div>
      {est != null && (
        <div class="hrow">
          <Img src={img.rank(est)} class="rank" w={44} h={44} alt="" />
          <div class="col">
            <span style="font-weight:600">{tierName(est)}</span>
            <span class="small muted num">lobby médio · {games} partidas</span>
          </div>
        </div>
      )}
      <div>
        {verdict && <div class="kv"><span class="muted">vs. seu rank</span><span>{verdict}</span></div>}
        {avgGain != null && avgLoss != null && (
          <div class="kv"><span class="muted">RR médio</span><span class="num">+{Math.round(avgGain)} / −{Math.round(avgLoss)}</span></div>
        )}
      </div>
    </div>
  );
};

export const ProfilePage = ({ p, queue, pages, rrs, social }: { p: Profile; queue: Queue; pages: number; rrs: Map<string, RrPoint>; social: Social }) => {
  const a = p.account;
  const base = profileUrl(p.region, a.name, a.tag);
  // DM/TDM have no rounds, so ACS/ADR are meaningless: they get their own numbers and stay out of the mixed totals
  const flatQ = queue === 'deathmatch' || queue === 'hurm';
  const lines = p.matches.filter((m) => flatQ || !noRounds(m)).map((m) => lineOf(m, a.puuid)).filter((l): l is Line => !!l);
  const t = totals(lines);
  const firsts = queue === 'deathmatch' ? p.matches.filter((m) => placeOf(m, a.puuid) === 1).length : 0;
  const agents = groupBy(lines, 'agent').slice(0, 3);
  const cur = p.mmr?.current;
  const season = p.mmr?.seasonal?.at(-1);
  const hist20 = p.history.slice(0, 20).reverse();
  const elos = hist20.map((h) => h.elo);
  const elosGain = elos.length > 1 ? elos[elos.length - 1] - elos[0] : 0;
  const qs = (q: Queue, n = 1) => {
    const s = new URLSearchParams();
    if (q !== 'competitive') s.set('queue', q);
    if (n > 1) s.set('n', String(n * 10));
    const str = s.toString();
    return `${base}${str ? `?${str}` : ''}#partidas`;
  };

  return (
    <Shell title={`${a.name}#${a.tag}`} region={p.region} og={{
      title: `${a.name}#${a.tag} · ${cur && cur.tier.id >= 3 ? `${tierName(cur.tier.id)} ${cur.rr} RR` : 'Valorant'}`,
      desc: t.games ? `${fmt.pct(t.winRate)} de vitória · K/D ${fmt.two(t.kd)} · ACS ${fmt.int(t.acs)} nas últimas ${t.games} partidas` : undefined,
      image: `/og/p/${p.region}/${encodeURIComponent(a.name)}/${encodeURIComponent(a.tag)}`, path: base,
    }}>
      <div class="prof">
        <aside class="side in">
          <div style="display:flex;flex-direction:column;gap:14px">
            {a.card ? <Img src={img.card(a.card)} class="pcard" w={72} h={72} alt="Card do jogador" /> : <div class="pcard hatch"></div>}
            <div>
              <h1 class="title"><RiotId name={a.name} tag={a.tag} /></h1>
              <p class="sub num" style="margin-top:4px">Nível {a.account_level} · {p.region.toUpperCase()} · atualizado {ago(p.fetchedAt)}</p>
            </div>
            <div class="actions">
              <form method="post" action={`${base}/refresh`}>
                <button class="btn" type="submit"><Icon name="refresh" size={14} />Atualizar</button>
              </form>
              <button class="btn" type="button" data-copy={`${a.name}#${a.tag}`}
                onclick="navigator.clipboard.writeText(this.dataset.copy).then(()=>{this.lastChild.textContent='Copiado'})">
                <Icon name="copy" size={14} /><span>Copiar ID</span>
              </button>
              <button class="btn fav" type="button" aria-pressed="false" hidden
                data-fav={JSON.stringify({ id: `${a.name}#${a.tag}`, href: profileUrl(p.region, a.name, a.tag), card: a.card ? img.card(a.card) : '', sub: `${cur && cur.tier.id >= 3 ? tierName(cur.tier.id) : 'Sem rank'} · ${p.region.toUpperCase()}` })}>
                <Icon name="star" size={14} /><span>Favoritar</span>
              </button>
              <a class="btn" href={`/compare?a=${encodeURIComponent(`${a.name}#${a.tag}`)}`}><Icon name="user" size={14} />Comparar</a>
              <a class="btn" href={`${base}/recap`}><Icon name="share" size={14} />Resumo do ato</a>
            </div>
            {p.warn && <p class="note"><Icon name="info" size={14} />Alguns dados podem estar desatualizados.</p>}
          </div>

          <div class="card pad" style="display:flex;flex-direction:column;gap:14px">
            {cur && cur.tier.id >= 3 ? (
              <>
                <div class="hrow" style="gap:12px">
                  <Img src={img.rank(cur.tier.id)} class="rank" w={44} h={44} alt="" />
                  <div class="col">
                    <span class="small muted">Rank atual</span>
                    <span style="font-weight:600">{tierName(cur.tier.id)}</span>
                  </div>
                  <div class="num" style="margin-left:auto;text-align:right">
                    <div style="font-size:22px;font-weight:600;letter-spacing:-.02em">{cur.rr}</div>
                    <div class="small muted">{cur.leaderboard_placement?.rank ? `#${cur.leaderboard_placement.rank}` : 'RR'}</div>
                  </div>
                </div>
                {cur.tier.id < 27 && <div class="bar" role="img" aria-label={`${cur.rr} de 100 RR`}><i style={`width:${Math.min(100, cur.rr)}%`}></i></div>}
              </>
            ) : (
              <div class="hrow" style="gap:12px">
                <div class="rank hatch" style="border-radius:12px"></div>
                <div class="col"><span class="small muted">Rank atual</span><span style="font-weight:600">Sem rank</span></div>
              </div>
            )}
            <div>
              {p.mmr?.peak && <div class="kv"><span class="muted">Pico</span><span class="num">{tierName(p.mmr.peak.tier.id)} · {p.mmr.peak.season.short.toUpperCase()}</span></div>}
              {season && <div class="kv"><span class="muted">Temporada</span><span class="num">{season.games} part. · {season.wins}V {season.games - season.wins}D</span></div>}
              {cur && cur.tier.id >= 3 && <div class="kv"><span class="muted">Última mudança</span><span class="num">{fmt.signed(cur.last_change)} RR</span></div>}
            </div>
          </div>

          <MmrCard p={p} />

          {elos.length > 1 && (
            <div class="card pad" style="display:flex;flex-direction:column;gap:10px">
              <div style="display:flex;justify-content:space-between;align-items:baseline">
                <span style="font-size:14px;font-weight:600">RR · últimas {elos.length}</span>
                <span class="num small muted">{fmt.signed(elosGain)} RR</span>
              </div>
              <Sparkline elos={elos} />
              <div class="num small muted" style="display:flex;justify-content:space-between;font-size:11px">
                <span>{histLabel(hist20[0])}</span><span>{histLabel(hist20[hist20.length - 1])}</span>
              </div>
            </div>
          )}
        </aside>

        <main class="main" id="pmain">
          <div class="in" style="--d:60ms"><ProfileTabs base={base} on="overview" /></div>

          <section class="in" style="--d:120ms">
            <div class="sh"><h2>Desempenho</h2><span class="muted num small">{QUEUES[queue]} · últimas {t.games}</span></div>
            {t.games && flatQ ? (
              <div class="grid3">
                <div class="card kpi"><b>{fmt.two(t.kd)}</b><span class="num">K/D · {t.k} / {t.d}</span></div>
                <div class="card kpi"><b>{fmt.one(t.k / t.games)}</b><span>Abates / partida</span></div>
                {queue === 'deathmatch'
                  ? <div class="card kpi"><b>{firsts}</b><span class="num">Vezes em 1º · {t.games} partidas</span></div>
                  : <div class="card kpi"><b>{fmt.pct(t.winRate)}</b><span class="num">Vitórias · {t.wins}V {t.losses}D</span></div>}
              </div>
            ) : t.games ? (
              <div class="grid3">
                <div class="card kpi"><b>{fmt.two(t.kd)}</b><span class="num">K/D · {t.k} / {t.d}</span></div>
                <div class="card kpi"><b>{fmt.pct(t.winRate)}</b><span class="num">Vitórias · {t.wins}V {t.losses}D</span></div>
                <div class="card kpi"><b>{fmt.pct1(t.hsRate)}</b><span>Headshot</span></div>
                <div class="card kpi"><b>{fmt.int(t.acs)}</b><span>ACS médio</span></div>
                <div class="card kpi"><b>{fmt.int(t.adr)}</b><span>ADR</span></div>
                <div class="card kpi"><b>{fmt.one(t.fkPerGame)}</b><span>First kills / partida</span></div>
              </div>
            ) : <div class="card empty">Sem partidas recentes nessa fila.</div>}
          </section>

          <section id="partidas" class="in" style="--d:180ms;scroll-margin-top:16px">
            <div class="sh"><h2>Partidas</h2>
              <nav class="tabs" aria-label="Fila">
                {(Object.keys(QUEUES) as Queue[]).map((q) => (
                  <a class={`tab${q === queue ? ' on' : ''}`} href={qs(q)} data-swap="#pmain" aria-current={q === queue ? 'true' : undefined}>{QUEUES[q]}</a>
                ))}
              </nav>
            </div>
            <div class="card scroll">
              {p.matches.length ? (
                <div style="min-width:680px">
                  <div class="mhead"><span></span><span>Mapa · agente</span><span class="r">Placar</span><span class="r">K / D / A</span><span class="r" title="Performance Score; ACS nas partidas antigas">PS</span><span class="r">HS</span><span class="r">RR</span><span></span></div>
                  {p.matches.map((m) => {
                    const l = lineOf(m, a.puuid);
                    if (!l) return null;
                    const me = m.players.find((x) => x.puuid === a.puuid)!;
                    const mine = m.teams[me.team];
                    const shots = l.hs + l.bs + l.ls;
                    const rr = rrs.get(m.id);
                    const ffa = isFfa(m), flat = noRounds(m);
                    const place = ffa ? placeOf(m, a.puuid) : 0;
                    const cls = ffa ? (place === 1 ? 'w' : 'e') : l.win ? 'w' : l.draw ? 'e' : 'l';
                    return (
                      <a class="mrow" href={`/m/${p.region}/${m.id}?p=${a.puuid}`}>
                        {ffa
                          ? <span class={`res ${cls}`} aria-label={`${place}º lugar`} title={`${place}º de ${m.players.length}`}>{place}º</span>
                          : <span class={`res ${cls}`} aria-label={l.win ? 'Vitória' : l.draw ? 'Empate' : 'Derrota'}>{l.win ? 'V' : l.draw ? 'E' : 'D'}</span>}
                        <span class="hrow" style="gap:12px">
                          <Img src={img.agent(l.agentId)} class="ag" w={32} h={32} />
                          <span class="col">
                            <span class="ell" style="font-weight:500">{m.map}</span>
                            <span class="small muted ell">{l.agent} · {queue === 'all' ? `${m.queueName} · ` : ''}{ago(m.started)}</span>
                          </span>
                        </span>
                        <span class="r num" style="font-weight:500;white-space:nowrap">{ffa ? `${place}º de ${m.players.length}` : mine ? `${mine.won}–${mine.lost}` : '—'}</span>
                        <span class="r num">{l.k} / {l.d} / {l.a}</span>
                        {flat && !me.perf
                          ? <span class="r num muted" title="Sem ACS neste modo">—</span>
                          : me.perf
                          ? <span class="r num" style="font-weight:500" title={`Performance Score · ACS ${fmt.int(l.score / l.rounds)}`}>{fmt.int(me.perf.score)}{m.mvp === me.puuid && <> <Crown size={12} /></>}</span>
                          : <span class="r num muted" title="ACS (partida salva antes do Performance Score)">{fmt.int(l.score / l.rounds)}</span>}
                        <span class="r num muted">{shots ? fmt.pct(l.hs / shots) : '—'}</span>
                        <span class="r num">{rr ? <RrDelta p={rr} /> : <span class="muted">—</span>}</span>
                        <Icon name="chevron" class="go" />
                      </a>
                    );
                  })}
                </div>
              ) : <div class="empty">Nenhuma partida encontrada nessa fila.</div>}
            </div>
            {p.hasMore && (
              <div style="display:flex;justify-content:center;padding-top:16px">
                <a class="btn" href={qs(queue, pages + 1)} data-swap="#pmain">Carregar mais 10</a>
              </div>
            )}
          </section>

          {agents.length > 0 && (
            <section class="in" style="--d:240ms">
              <div class="sh"><h2>Agentes mais jogados</h2><a class="muted small" href={`${base}/stats`} style="text-underline-offset:3px">Ver todos</a></div>
              <div class="grid3">
                {agents.map((g) => (
                  <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">
                    <div class="hrow">
                      <Img src={img.agent(g.id)} class="ag" w={32} h={32} />
                      <span style="font-weight:600" class="ell">{g.name}</span>
                      <span class="num small muted" style="margin-left:auto">{g.games} part.</span>
                    </div>
                    <div class="num" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;font-size:13px">
                      <div><div style="font-weight:600">{fmt.pct(g.winRate)}</div><div class="muted" style="font-size:11px">Vitórias</div></div>
                      <div><div style="font-weight:600">{fmt.two(g.kd)}</div><div class="muted" style="font-size:11px">K/D</div></div>
                      {flatQ
                        ? <div><div style="font-weight:600">{fmt.one(g.k / g.games)}</div><div class="muted" style="font-size:11px">Abates/part.</div></div>
                        : <div><div style="font-weight:600">{fmt.int(g.acs)}</div><div class="muted" style="font-size:11px">ACS</div></div>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <SocialSection s={social} region={p.region} />
        </main>
      </div>
    </Shell>
  );
};
