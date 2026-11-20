import { Img } from './ui.js';
import { rrAvg, winRate, type Agg, type Social } from '../social.js';
import { fmt, img, profileUrl, ratio } from '../lib.js';

const rrText = (a: Agg) => { const v = rrAvg(a); return v == null ? '—' : `${fmt.signed(Math.round(v))}`; };

const Mode = ({ label, a, hint }: { label: string; a: Agg; hint: string }) => (
  <div class="card kpi">
    <b>{a.games ? fmt.pct(winRate(a)) : '—'}</b>
    <span class="num">{label} · {a.wins}V {a.losses}D</span>
    <span class="num small muted" style="margin-top:2px">{a.games ? `RR/partida ${rrText(a)} · K/D ${fmt.two(ratio(a.k, a.d))}` : hint}</span>
  </div>
);

const Who = ({ region, p }: { region: string; p: { name: string; tag: string; card: string } }) => (
  <span class="hrow" style="gap:10px;min-width:0">
    {p.card ? <Img src={img.card(p.card)} class="ag" w={32} h={32} /> : <span class="ag hatch"></span>}
    <a href={profileUrl(region, p.name, p.tag)} class="ell" translate="no" style="font-weight:500;text-decoration:none">{p.name}<span class="muted" style="font-weight:400">#{p.tag}</span></a>
  </span>
);

export const SocialSection = ({ s, region }: { s: Social; region: string }) => {
  if (s.games < 3) return null;
  return (
    <section class="in" style="--d:300ms">
      <div class="sh"><h2>Duo e companheiros</h2><span class="muted num small">competitivo · {s.games} partidas detalhadas</span></div>
      <div class="grid2">
        <Mode label="Solo" a={s.solo} hint="Nenhuma partida solo" />
        <Mode label="Em grupo" a={s.group} hint="Nenhuma partida em grupo" />
      </div>

      {s.partners.length > 0 && (
        <div class="card scroll" style="margin-top:12px">
          <table style="min-width:600px">
            <thead><tr><th>Jogou junto com</th><th>Partidas</th><th>V–D</th><th>Vitórias</th><th title="RR médio por partida juntos">RR/part.</th><th title="O seu K/D nessas partidas">Seu K/D</th></tr></thead>
            <tbody>
              {s.partners.map((p) => (
                <tr>
                  <td>
                    <span class="hrow" style="gap:8px">
                      <Who region={region} p={p} />
                      {p === s.best && <span class="tag ink">melhor duo</span>}
                      {p === s.worst && <span class="tag out">pior duo</span>}
                    </span>
                  </td>
                  <td>{p.games}</td><td>{p.wins}–{p.losses}</td><td style="font-weight:500">{fmt.pct(winRate(p))}</td>
                  <td>{rrText(p)}</td><td>{fmt.two(ratio(p.k, p.d))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {s.encounters.length > 0 && (
        <>
          <div class="sh" style="margin-top:28px"><h2>Encontros frequentes</h2><span class="muted small">fora do seu grupo, 2+ partidas</span></div>
          <div class="card" style="padding:4px 16px">
            {s.encounters.map((e) => (
              <div class="kv" style="align-items:center">
                <Who region={region} p={e} />
                <span class="num small" title="V = suas vitórias nessas partidas">
                  {e.with > 0 && <span>{e.with}× no seu time <span class="muted">({e.withWins}V)</span></span>}
                  {e.with > 0 && e.against > 0 && <span class="muted"> · </span>}
                  {e.against > 0 && <span>{e.against}× contra <span class="muted">({e.againstWins}V)</span></span>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
};
