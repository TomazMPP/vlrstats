import { Footer, Icon, Img, Layout, Logo } from './ui.js';
import { REGIONS, ago, img, profileUrl, tierName } from '../lib.js';

export type Recent = { r: string; n: string; t: string; tier: number; card: string; at: number };

export const Home = ({ recent, region, value, hint }: {
  recent: Recent[]; region: string; value?: string; hint?: string;
}) => (
  <Layout>
    <div class="wrap page">
      <header class="top">
        <a class="brand" href="/"><Logo />vlrstats</a>
      </header>

      <main class="home">
        <div class="hero in">
          <h1 class="title">Suas partidas de Valorant, analisadas.</h1>
          <p>Busque por Riot ID e veja rank, histórico de partidas e desempenho por agente, mapa e arma.</p>
        </div>

        <form class="card search in" style="--d:80ms" role="search" action="/search" method="get">
          <div class="form">
            <div class="grow">
              <label class="label" for="rid">Riot ID</label>
              <div class="field">
                <Icon name="search" />
                <input class="input" id="rid" name="riotid" type="text" autocomplete="off" spellcheck={false}
                  placeholder="Nome#TAG" required autofocus value={value} aria-describedby="rid-hint" />
              </div>
            </div>
            <div>
              <label class="label" for="reg">Região</label>
              <select class="select" id="reg" name="region">
                {REGIONS.map((r) => <option value={r} selected={r === region}>{r.toUpperCase()}</option>)}
              </select>
            </div>
            <button class="btn btn-ink btn-lg" type="submit">Buscar<Icon name="arrow" /></button>
          </div>
          <p id="rid-hint" class="small" style={hint ? 'color:var(--fg)' : 'color:var(--fg-3)'}>
            {hint ?? <>O TAG fica depois do #. Ex.: <span class="num" translate="no">nome#br1</span></>}
          </p>
        </form>

        {recent.length > 0 && (
          <section class="in" style="--d:160ms;display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;justify-content:space-between;align-items:baseline">
              <h2 style="font-size:15px;font-weight:600">Buscas recentes</h2>
              <form action="/recent/clear" method="post"><button class="linkbtn" type="submit">Limpar</button></form>
            </div>
            <div class="card clip">
              {recent.map((p) => (
                <a class="row" href={profileUrl(p.r, p.n, p.t)}>
                  {p.card ? <Img src={img.card(p.card)} class="av" w={36} h={36} /> : <span class="av hatch" aria-hidden="true"></span>}
                  <span class="col" style="flex:1 1 auto">
                    <span class="ell" style="font-weight:500" translate="no">{p.n}<span class="muted">#{p.t}</span></span>
                    <span class="small muted">{tierName(p.tier)} · {p.r.toUpperCase()}</span>
                  </span>
                  <span class="num small muted">{ago(p.at)}</span>
                  <Icon name="out" class="go" />
                </a>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
    <div class="wrap"><Footer /></div>
  </Layout>
);
