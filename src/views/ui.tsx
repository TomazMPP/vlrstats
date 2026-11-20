import type { Child, FC } from 'hono/jsx';
import { raw } from 'hono/html';
import { REGIONS } from '../lib.js';

export const ASSET_V = '1';

export const Logo = () => (
  <span class="mark" aria-hidden="true">
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
      <rect x="1" y="3" width="2.6" height="14" rx="1.3" />
      <rect x="4.85" y="7" width="2.6" height="10" rx="1.3" />
      <rect x="8.7" y="11" width="2.6" height="6" rx="1.3" />
      <rect x="12.55" y="7" width="2.6" height="10" rx="1.3" />
      <rect x="16.4" y="3" width="2.6" height="14" rx="1.3" />
    </svg>
  </span>
);

const paths = {
  search: <><circle cx="9" cy="9" r="5.5" /><path d="M13.2 13.2L17 17" /></>,
  arrow: <path d="M4 10h12M11 5l5 5-5 5" />,
  chevron: <path d="M8 5l5 5-5 5" />,
  back: <path d="M12 5l-5 5 5 5" />,
  out: <path d="M7 13l6-6M8 7h5v5" />,
  refresh: <path d="M16 10a6 6 0 1 1-1.8-4.3M16 4v3.5h-3.5" />,
  copy: <><rect x="7" y="7" width="9" height="9" rx="2" /><path d="M4 13V5a1 1 0 0 1 1-1h8" /></>,
  user: <><circle cx="10" cy="7" r="3" /><path d="M4 17a6 6 0 0 1 12 0" /></>,
  clock: <><circle cx="10" cy="10" r="6.5" /><path d="M10 6.5V10l2.5 1.5" /></>,
  alert: <><path d="M10 3.5l7 12.5H3z" /><path d="M10 8.5v3M10 14h.01" /></>,
  info: <><circle cx="10" cy="10" r="6.5" /><path d="M10 9v4M10 6.5h.01" /></>,
} as const;

export const Icon = ({ name, size = 16, class: cls }: { name: keyof typeof paths; size?: number; class?: string }) => (
  <svg class={cls} width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {paths[name]}
  </svg>
);

/** Image with fixed box; hides itself (keeps hatch background) if the CDN fails. */
export const Img = (p: { src: string; class: string; alt?: string; w: number; h: number }) => (
  <img src={p.src} class={p.class} alt={p.alt ?? ''} width={p.w} height={p.h} loading="lazy" decoding="async" onerror="this.style.visibility='hidden'" />
);

export const RiotId = ({ name, tag }: { name: string; tag: string }) => (
  <span translate="no">{name}<span class="muted">#{tag}</span></span>
);

export const MiniSearch = ({ region = 'br' }: { region?: string }) => (
  <form class="mini" role="search" action="/search" method="get">
    <label for="q" class="sr">Buscar jogador</label>
    <Icon name="search" />
    <input id="q" name="riotid" type="text" placeholder="Nome#TAG" autocomplete="off" spellcheck={false} required />
    <label for="qr" class="sr">Região</label>
    <select id="qr" name="region">
      {REGIONS.map((r) => <option value={r} selected={r === region}>{r.toUpperCase()}</option>)}
    </select>
  </form>
);

export const Header = ({ children, region }: { children?: Child; region?: string }) => (
  <header class="top">
    {children ?? <a class="brand" href="/"><Logo />vlrstats</a>}
    <MiniSearch region={region} />
  </header>
);

export const Footer = () => (
  <footer class="foot">
    <span>Dados via HenrikDev API. Não afiliado à Riot Games.</span>
    <span class="num">v0.1</span>
  </footer>
);

export const Layout: FC<{ title?: string; children: Child; noindex?: boolean }> = ({ title, children, noindex }) => (
  <>
    {raw('<!DOCTYPE html>')}
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title ? `${title} · vlrstats` : 'vlrstats · Suas partidas de Valorant, analisadas'}</title>
        <meta name="description" content="Busque por Riot ID e veja rank, histórico de partidas e desempenho por agente, mapa e arma." />
        {noindex && <meta name="robots" content="noindex" />}
        <meta name="theme-color" content="#f8f6f2" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1f1d1a" media="(prefers-color-scheme: dark)" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://media.valorant-api.com" crossorigin="" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" />
        <link rel="stylesheet" href={`/styles.css?v=${ASSET_V}`} />
      </head>
      <body>
        <div class="dots" aria-hidden="true"></div>
        {children}
      </body>
    </html>
  </>
);

/** Page shell used by all inner pages. */
export const Shell: FC<{ title?: string; region?: string; head?: Child; children: Child }> = ({ title, region, head, children }) => (
  <Layout title={title}>
    <div class="wrap page">
      <Header region={region}>{head}</Header>
      {children}
    </div>
    <div class="wrap"><Footer /></div>
  </Layout>
);
