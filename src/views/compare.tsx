import { Icon, Img, RiotId, Shell } from './ui.js';
import { groupBy, totals, type CMatch, type Line, type Profile } from '../data.js';
import { ago, fmt, img, profileUrl, tierName, tierShort } from '../lib.js';

export type Side = { p: Profile; lines: Line[] };
type H2H = { together: { games: number; wins: number }; apart: { games: number; a: number; b: number }; list: { m: CMatch; same: boolean; aWin: boolean; draw: boolean }[] };

export function headToHead(ms: CMatch[], a: string, b: string): H2H {
  const r: H2H = { together: { games: 0, wins: 0 }, apart: { games: 0, a: 0, b: 0 }, list: [] };
  for (const m of ms) {
    const pa = m.players.find((p) => p.puuid === a), pb = m.players.find((p) => p.puuid === b);
    if (!pa || !pb) continue;
    const ta = m.teams[pa.team], tb = m.teams[pb.team];
    const draw = !!ta && !!tb && ta.won === tb.won && !ta.win && pa.team !== pb.team;
    const same = pa.team === pb.team;
    if (same) { r.together.games++; if (ta?.win) r.together.wins++; }
    else { r.apart.games++; if (ta?.win) r.apart.a++; else if (tb?.win) r.apart.b++; }
    r.list.push({ m, same, aWin: !!ta?.win, draw });
  }
  return r;
}

/** One stat row: the better side is bold, plus a two-sided bar. */
const Row = ({ label, a, b, fa, sa, sb, higher = true }: { label: string; a: number | null; b: number | null; fa: (v: number) => string; sa?: string; sb?: string; higher?: boolean }) => {
  const ok = a != null && b != null && a !== b;
  const aBest = ok && (higher ? a! > b! : a! < b!);
  const bBest = ok && !aBest;
  const sum = (a ?? 0) + (b ?? 0);
  const share = sum > 0 && a != null && b != null ? (a / sum) * 100 : 50;
  return (
    <div class="cmp-row">
      <span class={`num${aBest ? ' best' : ''}`}>{a == null ? '—' : sa ?? fa(a)}</span>
      <span class="cmp-mid">
        <span class="small muted">{label}</span>
        <span class="cmp-bar" aria-hidden="true"><i style={`width:${share.toFixed(1)}%`}></i></span>
      </span>
      <span class={`num r${bBest ? ' best' : ''}`}>{b == null ? '—' : sb ?? fa(b)}</span>
    </div>
  );
};

const Head = ({ s, right }: { s: Side; right?: boolean }) => {
  const a = s.p.account, cur = s.p.mmr?.current;
  return (
    <a class={`card cmp-head${right ? ' right' : ''}`} href={profileUrl(s.p.region, a.name, a.tag)}>
      {a.card ? <Img src={img.card(a.card)} class="pcard" w={56} h={56} /> : <span class="pcard hatch"></span>}
      <span class="col" style="min-width:0;gap:4px">
        <b class="ell" style="font-size:17px"><RiotId name={a.name} tag={a.tag} /></b>
        <span class="hrow small muted" style={`gap:6px${right ? ';justify-content:flex-end' : ''}`}>
          {cur && cur.tier.id >= 3 && <Img src={img.rank(cur.tier.id)} class="rank-sm" w={20} h={20} />}
          {cur && cur.tier.id >= 3 ? `${tierName(cur.tier.id)} · ${cur.rr} RR` : 'Sem rank'}
        </span>
      </span>
    </a>
  );
};

export const ComparePage = ({ A, B, h2h, raw }: { A: Side; B: Side | null; h2h: H2H | null; raw: { a: string; b: string } }) => {
  const ta = totals(A.lines), tb = B ? totals(B.lines) : null;
  const an = A.p.account;
  const form = (
    <form class="cmp-form" action="/compare" method="get" role="search">
      <input type="hidden" name="a" value={`${an.name}#${an.tag}`} />
      <label for="cmp-b" class="sr">Comparar com</label>
      <input id="cmp-b" class="input" name="b" type="text" placeholder="Comparar com Nome#TAG" value={raw.b} autocomplete="off" spellcheck={false} required list="suggest" />
      <button class="btn btn-ink" type="submit">Comparar</button>
    </form>
  );
  if (!B || !tb) {
    return (
      <Shell title={`Comparar ${an.name}#${an.tag}`} region={A.p.region}>
        <div class="stack">
          <div class="in"><h1 class="title">Comparar jogadores</h1><p class="sub" style="margin-top:4px">Escolha com quem comparar <RiotId name={an.name} tag={an.tag} />.</p></div>
          <div class="in" style="--d:60ms">{form}</div>
        </div>
      </Shell>
    );
  }
  const bn = B.p.account;
  const peak = (s: Side) => s.p.mmr?.peak?.tier.id ?? null;
  const elo = (s: Side) => ((s.p.mmr?.current.tier.id ?? 0) >= 3 ? s.p.mmr!.current.elo : null);
  const rankText = (s: Side) => `${tierShort(s.p.mmr?.current.tier.id ?? 0)} · ${s.p.mmr?.current.rr ?? 0}`;
  const mapsA = new Map(groupBy(A.lines, 'map').map((g) => [g.name, g]));
  const mapsB = new Map(groupBy(B.lines, 'map').map((g) => [g.name, g]));
  const maps = [...new Set([...mapsA.keys(), ...mapsB.keys()])]
    .map((name) => ({ name, a: mapsA.get(name), b: mapsB.get(name) }))
    .filter((x) => (x.a?.games ?? 0) + (x.b?.games ?? 0) >= 3)
    .sort((x, y) => (y.a?.games ?? 0) + (y.b?.games ?? 0) - (x.a?.games ?? 0) - (x.b?.games ?? 0));
  const agA = groupBy(A.lines, 'agent').slice(0, 4), agB = groupBy(B.lines, 'agent').slice(0, 4);

  return (
    <Shell title={`${an.name} vs ${bn.name}`} region={A.p.region}>
      <div class="stack">
        <div class="in" style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap">
          <div>
            <h1 class="title">Comparar jogadores</h1>
            <p class="sub num" style="margin-top:4px">Competitivo · últimas {ta.games} e {tb.games} partidas</p>
          </div>
          {form}
        </div>

        <div class="cmp-heads in" style="--d:40ms">
          <Head s={A} /><span class="cmp-vs muted">vs</span><Head s={B} right />
        </div>

        <section class="in" style="--d:80ms">
          <div class="sh"><h2>Números</h2><span class="muted small">em negrito, o melhor</span></div>
          <div class="card pad cmp">
            <Row label="Rank atual" a={elo(A)} b={elo(B)} fa={String} sa={rankText(A)} sb={rankText(B)} />
            <Row label="Pico" a={peak(A)} b={peak(B)} fa={tierShort} />
            <Row label="Vitórias" a={ta.winRate} b={tb.winRate} fa={fmt.pct} />
            <Row label="K/D" a={ta.kd} b={tb.kd} fa={fmt.two} />
            <Row label="KDA" a={ta.kda} b={tb.kda} fa={fmt.two} />
            <Row label="ACS" a={ta.acs} b={tb.acs} fa={fmt.int} />
            <Row label="ADR" a={ta.adr} b={tb.adr} fa={fmt.int} />
            <Row label="Headshot" a={ta.hsRate} b={tb.hsRate} fa={fmt.pct1} />
          </div>
        </section>

        <div class="two in" style="--d:140ms">
          <section>
            <div class="sh"><h2>Mapas</h2><span class="muted small">% de vitória · partidas</span></div>
            <div class="card" style="padding:4px 18px">
              {maps.length ? maps.map((x) => (
                <div class="kv">
                  <span class={`num${(x.a?.winRate ?? -1) > (x.b?.winRate ?? -1) ? ' best' : ''}`}>{x.a ? `${fmt.pct(x.a.winRate)} · ${x.a.games}` : '—'}</span>
                  <span style="font-weight:500">{x.name}</span>
                  <span class={`num${(x.b?.winRate ?? -1) > (x.a?.winRate ?? -1) ? ' best' : ''}`}>{x.b ? `${fmt.pct(x.b.winRate)} · ${x.b.games}` : '—'}</span>
                </div>
              )) : <div class="empty">Poucas partidas por mapa.</div>}
            </div>
          </section>
          <section>
            <div class="sh"><h2>Agentes</h2><span class="muted small">mais jogados</span></div>
            <div class="grid2 cmp-agents">
              {[agA, agB].map((ags) => (
                <div class="card" style="padding:4px 14px">
                  {ags.map((g) => (
                    <div class="kv" style="align-items:center">
                      <span class="hrow" style="gap:8px;min-width:0"><Img src={img.agent(g.id)} class="ag ag-sm" w={24} h={24} /><span class="ell">{g.name}</span></span>
                      <span class="num small muted">{g.games} · {fmt.pct(g.winRate)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </div>

        <section class="in" style="--d:200ms">
          <div class="sh"><h2>Frente a frente</h2><span class="muted small">partidas salvas com os dois</span></div>
          {h2h && h2h.list.length ? (
            <>
              <div class="grid2">
                <div class="card kpi"><b class="num">{h2h.together.wins}V {h2h.together.games - h2h.together.wins}D</b><span>No mesmo time · {h2h.together.games} partidas</span></div>
                <div class="card kpi"><b class="num">{h2h.apart.a} × {h2h.apart.b}</b><span>Um contra o outro · {an.name} × {bn.name}</span></div>
              </div>
              <div class="card" style="margin-top:12px">
                {h2h.list.slice(0, 10).map((x) => (
                  <a class="mrow cmp-match" href={`/m/${A.p.region}/${x.m.id}?p=${an.puuid}`}>
                    <span class="hrow" style="gap:10px">
                      {x.m.mapId ? <Img src={img.map(x.m.mapId)} class="ag cmp-map" w={48} h={32} /> : <span class="ag hatch"></span>}
                      <span class="col"><span style="font-weight:500">{x.m.map}</span><span class="small muted">{ago(x.m.started)}</span></span>
                    </span>
                    <span class="small">{x.same ? (x.aWin ? 'Juntos · vitória' : 'Juntos · derrota') : x.draw ? 'Contra · empate' : `Contra · venceu ${x.aWin ? an.name : bn.name}`}</span>
                    <Icon name="chevron" class="go" />
                  </a>
                ))}
              </div>
            </>
          ) : <div class="card empty">Nenhuma partida dos dois juntos entre as que temos salvas.</div>}
        </section>
      </div>
    </Shell>
  );
};
