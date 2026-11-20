import { Icon, Img, RiotId, SITE, Shell } from './ui.js';
import { fmt, img, profileUrl, tierName } from '../lib.js';
import type { Recap } from '../recap.js';

/** The act recap: the share image itself, ways to send it, and the same numbers as text. */
export const RecapPage = ({ region, name, tag, card, r }: { region: string; name: string; tag: string; card: string | null; r: Recap | null }) => {
  const base = profileUrl(region, name, tag);
  const path = `${base}/recap`;
  const png = `/og/r/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
  const a = r ? { ...r.act, short: r.act.short.toUpperCase() } : undefined;
  const title = a ? `${name}#${tag} no ato ${a.short}` : `${name}#${tag}`;
  const desc = a
    ? `${a.wins}V ${a.losses}D · ${tierName(r!.rank.tier)}${a.rrNet != null ? ` · ${fmt.signed(a.rrNet)} RR` : ''} · K/D ${fmt.two(a.kd)} · ACS ${fmt.int(a.acs)}`
    : undefined;
  const wa = `https://wa.me/?text=${encodeURIComponent(`${title}: ${SITE}${path}`)}`;

  return (
    <Shell title={`Resumo do ato · ${name}#${tag}`} region={region} og={{ title, desc, image: png, path }} head={
      <a class="btn" href={base}><Icon name="back" size={14} /><span translate="no">{name}#{tag}</span></a>
    }>
      <div class="stack">
        <div class="in hrow" style="gap:14px">
          {card ? <Img src={img.card(card)} class="pcard" w={48} h={48} /> : <span class="pcard hatch"></span>}
          <div>
            <h1 class="title">Resumo do ato{a?.short ? ` ${a.short}` : ''}</h1>
            <p class="sub" style="margin-top:4px"><RiotId name={name} tag={tag} /> · competitivo</p>
          </div>
        </div>

        {!r || !a ? (
          <div class="card empty in">Nenhuma partida competitiva salva neste ato ainda.</div>
        ) : (
          <>
            <figure class="card recap-fig in" style="--d:60ms">
              <img src={png} width={1200} height={630} alt={`Resumo do ato ${a.short} de ${name}#${tag}: ${desc}`} />
            </figure>
            <div class="hrow in recap-act" style="--d:100ms">
              <a class="btn btn-ink" href={png} download={`vlrstats-${name}-${a.short}.png`}><Icon name="down" size={14} />Baixar imagem</a>
              <button class="btn" type="button" data-copy={`${SITE}${path}`}
                onclick="navigator.clipboard.writeText(this.dataset.copy).then(()=>{this.lastChild.textContent='Link copiado'})">
                <Icon name="copy" size={14} /><span>Copiar link</span>
              </button>
              <a class="btn" href={wa} target="_blank" rel="noopener"><Icon name="share" size={14} />WhatsApp</a>
            </div>
            <p class="small muted in" style="--d:120ms">O link mostra esta imagem quando colado no Discord, WhatsApp ou X.</p>

            <section class="in" style="--d:140ms">
              <div class="sh"><h2>Os números</h2><span class="muted small">partidas salvas do ato</span></div>
              <div class="card" style="padding:4px 18px">
                <div class="kv"><span>Rank</span><span class="num">{tierName(r.rank.tier)}{r.rank.tier >= 3 ? ` · ${r.rank.rr} RR` : ''}</span></div>
                <div class="kv"><span>Pico no ato</span><span class="num">{tierName(r.rank.peak)}</span></div>
                <div class="kv"><span>Partidas</span><span class="num">{a.games} · {a.wins}V {a.losses}D · {fmt.pct(a.games ? a.wins / a.games : 0)}</span></div>
                {a.rrNet != null && <div class="kv"><span>Saldo de RR</span><span class="num">{fmt.signed(a.rrNet)}</span></div>}
                <div class="kv"><span>Maior sequência de vitórias</span><span class="num">{a.streak}</span></div>
                <div class="kv"><span>K/D · ACS · Headshot</span><span class="num">{fmt.two(a.kd)} · {fmt.int(a.acs)} · {fmt.pct(a.hsRate)}</span></div>
                {a.agent && <div class="kv"><span>Agente mais jogado</span><span class="num">{a.agent.name} · {a.agent.games}</span></div>}
                {a.map && <div class="kv"><span>Melhor mapa</span><span class="num">{a.map.name} · {fmt.pct(a.map.winRate)} em {a.map.games}</span></div>}
              </div>
            </section>
          </>
        )}
      </div>
    </Shell>
  );
};
