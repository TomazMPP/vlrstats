import { Icon, Img, Shell } from './ui.js';
import { Crown, GRADE, PerfCard, psTip } from './perf.js';
import { isFfa, leaderboard, noRounds, type CMatch, type CPlayer } from '../data.js';
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
  // Performance Score when the match has it, ACS otherwise
  const hasPs = m.players.some((p) => p.perf);
  const rank = (p: CPlayer) => (hasPs ? p.perf?.score ?? 0 : p.score);
  const byRank = [...m.players].sort((a, b) => rank(b) - rank(a));
  const mvp = m.mvp ?? (hasPs ? byRank[0]?.puuid : undefined);
  // Deathmatch is a free-for-all leaderboard; DM and TDM are one long "round"
  const ffa = isFfa(m);
  const flat = noRounds(m);
  const board = leaderboard(m);
  const place = me ? board.findIndex((p) => p.puuid === me.puuid) + 1 : 0;
  const n = m.players.length;
  const hasShots = m.players.some((p) => p.hs + p.bs + p.ls > 0);
  const hasDmg = m.players.some((p) => p.dmg > 0);
  const kd = (p: CPlayer) => fmt.two(ratio(p.k, Math.max(1, p.d)));
  const hsOf = (p: CPlayer) => { const s = p.hs + p.bs + p.ls; return s ? fmt.pct(p.hs / s) : '—'; };
  const mineStats: [string, string][] = !me ? [] : flat
    ? [['K / D / A', `${me.k} / ${me.d} / ${me.a}`], ['K/D', kd(me)], ['+/−', fmt.signed(me.k - me.d)],
      ...(hasShots ? [['HS', hsOf(me)] as [string, string]] : []), ...(hasDmg ? [['Dano', fmt.int(me.dmg)] as [string, string]] : [])]
    : [...(me.perf ? [['PS', fmt.int(me.perf.score)] as [string, string]] : []), ['K / D / A', `${me.k} / ${me.d} / ${me.a}`],
      ['ACS', fmt.int(ratio(me.score, nr))], ['ADR', fmt.int(ratio(me.dmg, nr))], ['HS', fmt.pct(ratio(me.hs, me.hs + me.bs + me.ls))]];

  /** Kills-first table for DM (numbered, one list) and TDM (per team). */
  const FlatTable = ({ players, numbered }: { players: CPlayer[]; numbered?: boolean }) => (
    <div class="card scroll">
      <table style="min-width:560px">
        <thead><tr>{numbered && <th style="width:44px">#</th>}<th style="text-align:left">Jogador</th><th>K</th><th>D</th><th>A</th><th>K/D</th><th>+/−</th>{hasShots && <th>HS</th>}{hasDmg && <th>Dano</th>}</tr></thead>
        <tbody>
          {players.map((p, i) => (
            <tr class={p.puuid === me?.puuid ? 'me' : undefined}>
              {numbered && <td class="muted" style="text-align:left">{i + 1}º</td>}
              <td style="text-align:left">
                <span class="hrow">
                  <Img src={img.agent(p.agentId)} class="ag" w={32} h={32} />
                  <span class="col" style="line-height:1.25">
                    <a href={profileUrl(region, p.name, p.tag)} translate="no">{p.name}<span class="muted" style="font-weight:400">#{p.tag}</span>{numbered && i === 0 && <> <Crown /></>}</a>
                    <span class="muted small" style="font-weight:400">{p.agent}</span>
                  </span>
                </span>
              </td>
              <td style="font-weight:600">{p.k}</td><td>{p.d}</td><td>{p.a}</td><td>{kd(p)}</td><td>{fmt.signed(p.k - p.d)}</td>
              {hasShots && <td class="muted">{hsOf(p)}</td>}{hasDmg && <td class="muted">{fmt.int(p.dmg)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <Shell title={`${m.map} · ${label}`} region={region} og={{
      title: `${m.map} · ${ffa ? (me ? `${place}º de ${n}` : label) : mine && other ? `${mine.won}–${other.won}` : label}${me ? ` · ${me.name}#${me.tag}` : ''}`,
      desc: me ? `${ffa ? `${label} · ${place}º de ${n}` : result} · ${me.agent} · ${me.k}/${me.d}/${me.a}${me.perf ? ` · PS ${fmt.int(me.perf.score)}` : ''}` : ffa || flat ? `${label} · ${n} jogadores` : `${label} · ${nr} rounds`,
      image: `/og/m/${region}/${m.id}${me ? `?p=${me.puuid}` : ''}`, path: `/m/${region}/${m.id}${me ? `?p=${me.puuid}` : ''}`,
    }} head={
      <a class="btn" href={backTo}><Icon name="back" size={14} />{me ? <span translate="no">{me.name}#{me.tag}</span> : 'vlrstats'}</a>
    }>
      <div class="stack">
        <section class="card mhero in">
          <div class="hrow" style="gap:16px">
            {m.mapId ? <Img src={img.map(m.mapId)} class="mapimg" w={96} h={64} alt={`Mapa ${m.map}`} /> : <div class="mapimg hatch"></div>}
            <div class="col">
              <div class="hrow" style="gap:8px"><h1 class="title">{m.map}</h1>{me && !ffa && <span class={`tag ${mine?.win ? 'ink' : 'out'}`}>{result}</span>}</div>
              <p class="sub num" style="margin-top:4px">
                {label} · {dateTime(m.started)} · {minutes(m.length)} · {region.toUpperCase()}
                {lobby != null && ` · lobby médio ${tierName(Math.round(lobby))}`}
              </p>
            </div>
          </div>
          {ffa && me && (
            <div class="score">
              <div style="text-align:center"><b>{place}º</b><div class="small muted" style="margin-top:4px">de {n} jogadores</div></div>
            </div>
          )}
          {!ffa && mine && other && (
            <div class="score">
              <div style="text-align:center"><b>{mine.won}</b><div class="small muted" style="margin-top:4px">{me ? 'Seu time' : TEAM_PT[myTeam] ?? myTeam}</div></div>
              <span class="muted" style="font-size:20px">:</span>
              <div style="text-align:center"><b style="color:var(--fg-3)">{other.won}</b><div class="small muted" style="margin-top:4px">Adversário</div></div>
            </div>
          )}
          {me && (
            <div class="mine num" style={`grid-template-columns:repeat(${mineStats.length},auto)`}>
              {mineStats.map(([k]) => <span class="muted">{k}</span>)}
              {mineStats.map(([, v]) => <b>{v}</b>)}
            </div>
          )}
        </section>

        {me?.perf && !flat && <PerfCard f={me.perf} rank={byRank.indexOf(me) + 1} of={byRank.length} mvp={mvp === me.puuid} />}

        {nr > 0 && !flat && (
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

        {ffa && (
          <section class="in" style="--d:140ms">
            <div class="sh"><h2>Classificação</h2><span class="muted small">por abates</span></div>
            <FlatTable players={board} numbered />
          </section>
        )}

        {!ffa && order.map((tid, ti) => {
          const team = m.teams[tid];
          const players = m.players.filter((p) => p.team === tid).sort((a, b) => rank(b) - rank(a));
          const tWin = team?.win;
          return (
            <section class="in" style={`--d:${140 + ti * 60}ms`}>
              <div class="sh">
                <h2>{me ? (tid === myTeam ? 'Seu time' : 'Adversário') : TEAM_PT[tid] ?? tid} <span class="muted num" style="font-weight:500">· {team ? `${team.won}–${team.lost}` : ''}</span></h2>
                <span class={`tag ${tWin ? 'ink' : 'out'}`}>{tWin ? 'Vitória' : draw ? 'Empate' : 'Derrota'}</span>
              </div>
              {flat ? <FlatTable players={players.sort((a, b) => b.k - a.k || a.d - b.d)} /> : <div class="card scroll">
                <table style={`min-width:${hasPs ? 820 : 760}px`}>
                  <thead><tr><th>Jogador</th><th>Rank</th>{hasPs && <th title="Performance Score">PS</th>}<th>ACS</th><th>K</th><th>D</th><th>A</th><th>+/−</th><th>ADR</th><th>HS</th><th>FK</th></tr></thead>
                  <tbody>
                    {players.map((p) => {
                      const shots = p.hs + p.bs + p.ls;
                      return (
                        <tr class={p.puuid === me?.puuid ? 'me' : undefined}>
                          <td>
                            <span class="hrow">
                              <Img src={img.agent(p.agentId)} class="ag" w={32} h={32} />
                              <span class="col" style="line-height:1.25">
                                <a href={profileUrl(region, p.name, p.tag)} translate="no">{p.name}<span class="muted" style="font-weight:400">#{p.tag}</span>{p.puuid === mvp && <> <Crown /></>}</a>
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
                          {hasPs && (
                            <td data-tip={psTip(p)} style="font-weight:600">
                              {p.perf ? fmt.int(p.perf.score) : '—'}
                              {p.perf && <span class="grade" aria-label={GRADE[p.perf.grade]}>{(GRADE[p.perf.grade] ?? '').slice(0, 1)}</span>}
                            </td>
                          )}
                          <td class={hasPs ? 'muted' : undefined}>{fmt.int(ratio(p.score, nr))}</td><td>{p.k}</td><td>{p.d}</td><td>{p.a}</td>
                          <td>{fmt.signed(p.k - p.d)}</td><td>{fmt.int(ratio(p.dmg, nr))}</td>
                          <td class="muted">{shots ? fmt.pct(p.hs / shots) : '—'}</td><td>{p.fk}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>}
            </section>
          );
        })}

        <p class="muted small">ID da partida <span class="num" translate="no">{m.id}</span></p>
      </div>
    </Shell>
  );
};
