import { Icon, Img, Shell } from './ui.js';
import type { CMatch, CPlayer } from '../data.js';
import { dateTime, fmt, img, minutes, profileUrl, ratio, tierName, tierShort } from '../lib.js';

const TEAM_PT: Record<string, string> = { Red: 'Time vermelho', Blue: 'Time azul' };

export const MatchPage = ({ m, me, region }: { m: CMatch; me?: CPlayer; region: string }) => {
  const teamIds = Object.keys(m.teams);
  const myTeam = me?.team ?? teamIds[0];
  const order = [myTeam, ...teamIds.filter((t) => t !== myTeam)];
  const mine = m.teams[myTeam];
  const other = order[1] ? m.teams[order[1]] : undefined;
  const nr = m.rounds.length;
  const draw = !!mine && !!other && mine.won === other.won;
  const result = mine?.win ? 'Vitória' : draw ? 'Empate' : 'Derrota';

  // my team's side in round 1 → halves
  const r0 = m.rounds[0];
  const startSide = r0 ? ((r0.w === myTeam) === (r0.role === 'Attacker') ? 'Ataque' : 'Defesa') : '';
  const otherSide = startSide === 'Ataque' ? 'Defesa' : 'Ataque';
  const won = (i: number) => m.rounds[i]?.w === myTeam;
  const half = (from: number, to: number) => {
    let w = 0, l = 0;
    for (let i = from; i < Math.min(to, nr); i++) won(i) ? w++ : l++;
    return `${w}–${l}`;
  };
  const Round = ({ i }: { i: number }) => (
    <div class={`rd ${won(i) ? 'w' : 'l'}`} title={`Round ${i + 1}: ${won(i) ? 'vencido' : 'perdido'}`}><i></i><span>{i + 1}</span></div>
  );
  const range = (a: number, b: number) => Array.from({ length: Math.max(0, Math.min(b, nr) - a) }, (_, k) => a + k);

  const others = m.players.filter((p) => p.puuid !== me?.puuid && p.tier >= 3);
  const lobby = others.length ? others.reduce((n, p) => n + p.tier, 0) / others.length : null;
  const backTo = me ? profileUrl(region, me.name, me.tag) : '/';
  const label = m.queue === 'competitive' ? 'Competitivo' : m.queueName;

  return (
    <Shell title={`${m.map} · ${label}`} region={region} head={
      <a class="btn" href={backTo}><Icon name="back" size={14} />{me ? <span translate="no">{me.name}#{me.tag}</span> : 'vlrstats'}</a>
    }>
      <div class="stack">
        <section class="card mhero in">
          <div class="hrow" style="gap:16px">
            {m.mapId ? <Img src={img.map(m.mapId)} class="mapimg" w={96} h={64} alt={`Mapa ${m.map}`} /> : <div class="mapimg hatch"></div>}
            <div class="col">
              <div class="hrow" style="gap:8px"><h1 class="title">{m.map}</h1>{me && <span class={`tag ${mine?.win ? 'ink' : 'out'}`}>{result}</span>}</div>
              <p class="sub num" style="margin-top:4px">
                {label} · {dateTime(m.started)} · {minutes(m.length)} · {region.toUpperCase()}
                {lobby != null && ` · lobby médio ${tierName(Math.round(lobby))}`}
              </p>
            </div>
          </div>
          {mine && other && (
            <div class="score">
              <div style="text-align:center"><b>{mine.won}</b><div class="small muted" style="margin-top:4px">{me ? 'Seu time' : TEAM_PT[myTeam] ?? myTeam}</div></div>
              <span class="muted" style="font-size:20px">:</span>
              <div style="text-align:center"><b style="color:var(--fg-3)">{other.won}</b><div class="small muted" style="margin-top:4px">Adversário</div></div>
            </div>
          )}
          {me && (
            <div class="mine num">
              <span class="muted">K / D / A</span><span class="muted">ACS</span><span class="muted">ADR</span><span class="muted">HS</span>
              <b>{me.k} / {me.d} / {me.a}</b><b>{fmt.int(ratio(me.score, nr))}</b><b>{fmt.int(ratio(me.dmg, nr))}</b>
              <b>{fmt.pct(ratio(me.hs, me.hs + me.bs + me.ls))}</b>
            </div>
          )}
        </section>

        {nr > 0 && (
          <section class="in" style="--d:80ms">
            <div class="sh"><h2>Rounds</h2>
              <span class="muted small">
                <span class="lgd" style="background:var(--fg)"></span>vencido &nbsp;
                <span class="lgd" style="box-shadow:inset 0 0 0 1px var(--line-strong)"></span>perdido
              </span>
            </div>
            <div class="card pad scroll">
              <div class="rounds">
                <span class="lbl">{startSide}</span>
                {range(0, 12).map((i) => <Round i={i} />)}
                {nr > 12 && <><span class="sep" aria-hidden="true"></span><span class="lbl">{otherSide}</span>{range(12, 24).map((i) => <Round i={i} />)}</>}
                {nr > 24 && <><span class="sep" aria-hidden="true"></span><span class="lbl">Prorr.</span>{range(24, nr).map((i) => <Round i={i} />)}</>}
              </div>
              <p class="num small muted" style="margin-top:14px">
                1º tempo {half(0, 12)}{nr > 12 && ` · 2º tempo ${half(12, 24)}`}{nr > 24 && ` · prorrogação ${half(24, nr)}`}
              </p>
            </div>
          </section>
        )}

        {order.map((tid, ti) => {
          const team = m.teams[tid];
          const players = m.players.filter((p) => p.team === tid).sort((a, b) => b.score - a.score);
          const tWin = team?.win;
          return (
            <section class="in" style={`--d:${140 + ti * 60}ms`}>
              <div class="sh">
                <h2>{me ? (tid === myTeam ? 'Seu time' : 'Adversário') : TEAM_PT[tid] ?? tid} <span class="muted num" style="font-weight:500">· {team ? `${team.won}–${team.lost}` : ''}</span></h2>
                <span class={`tag ${tWin ? 'ink' : 'out'}`}>{tWin ? 'Vitória' : draw ? 'Empate' : 'Derrota'}</span>
              </div>
              <div class="card scroll">
                <table style="min-width:760px">
                  <thead><tr><th>Jogador</th><th>Rank</th><th>ACS</th><th>K</th><th>D</th><th>A</th><th>+/−</th><th>ADR</th><th>HS</th><th>FK</th></tr></thead>
                  <tbody>
                    {players.map((p) => {
                      const shots = p.hs + p.bs + p.ls;
                      return (
                        <tr class={p.puuid === me?.puuid ? 'me' : undefined}>
                          <td>
                            <span class="hrow">
                              <Img src={img.agent(p.agentId)} class="ag" w={32} h={32} />
                              <span class="col" style="line-height:1.25">
                                <a href={profileUrl(region, p.name, p.tag)} translate="no">{p.name}<span class="muted" style="font-weight:400">#{p.tag}</span></a>
                                <span class="muted small" style="font-weight:400">{p.agent}</span>
                              </span>
                            </span>
                          </td>
                          <td>
                            <span class="hrow" style="justify-content:flex-end;gap:6px">
                              {p.tier >= 3 && <Img src={img.rank(p.tier)} class="rank-sm" w={22} h={22} />}
                              <span class="small" style="font-weight:400">{tierShort(p.tier)}</span>
                            </span>
                          </td>
                          <td>{fmt.int(ratio(p.score, nr))}</td><td>{p.k}</td><td>{p.d}</td><td>{p.a}</td>
                          <td>{fmt.signed(p.k - p.d)}</td><td>{fmt.int(ratio(p.dmg, nr))}</td>
                          <td class="muted">{shots ? fmt.pct(p.hs / shots) : '—'}</td><td>{p.fk}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

        <p class="muted small">ID da partida <span class="num" translate="no">{m.id}</span></p>
      </div>
    </Shell>
  );
};
