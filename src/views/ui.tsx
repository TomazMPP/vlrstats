import type { Child, FC } from 'hono/jsx';
import { raw } from 'hono/html';

export const ASSET_V = '16';

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
  sun: <><circle cx="10" cy="10" r="3.2" /><path d="M10 2.5v1.6M10 15.9v1.6M2.5 10h1.6M15.9 10h1.6M4.7 4.7l1.1 1.1M14.2 14.2l1.1 1.1M4.7 15.3l1.1-1.1M14.2 5.8l1.1-1.1" /></>,
  moon: <path d="M16 12.2A6.5 6.5 0 0 1 7.8 4a6.5 6.5 0 1 0 8.2 8.2z" />,
  down: <path d="M10 3.5v9M6 9l4 4 4-4M4 16.5h12" />,
  share: <><circle cx="14.5" cy="5" r="2" /><circle cx="5.5" cy="10" r="2" /><circle cx="14.5" cy="15" r="2" /><path d="M7.3 9l5.4-3M7.3 11l5.4 3" /></>,
  star: <path d="M10 2.8l2.2 4.5 4.9.7-3.55 3.47.84 4.9L10 14.06l-4.39 2.31.84-4.9L2.9 8l4.9-.7z" />,
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

export const MiniSearch = () => (
  <form class="mini" role="search" action="/search" method="get">
    <label for="q" class="sr">Buscar jogador</label>
    <Icon name="search" />
    <input id="q" name="riotid" type="text" placeholder="Nome#TAG" autocomplete="off" spellcheck={false} required list="suggest" />
    <datalist id="suggest"></datalist>
  </form>
);

export const ThemeToggle = () => (
  <button class="btn iconbtn" type="button" data-theme-toggle aria-label="Alternar tema claro ou escuro" title="Tema claro/escuro">
    <Icon name="moon" class="i-moon" /><Icon name="sun" class="i-sun" />
  </button>
);

/** Applies the saved theme (or the system one) before first paint and wires the toggle. */
const THEME_JS = `(()=>{const d=document.documentElement,m=matchMedia('(prefers-color-scheme: dark)');let s=null;try{s=localStorage.getItem('theme')}catch{}const set=t=>{d.dataset.theme=t};set(s||(m.matches?'dark':'light'));m.addEventListener('change',e=>{if(!s)set(e.matches?'dark':'light')});addEventListener('click',e=>{if(!e.target.closest('[data-theme-toggle]'))return;s=d.dataset.theme==='dark'?'light':'dark';set(s);try{localStorage.setItem('theme',s)}catch{}})})()`;

export const Header = ({ children, region }: { children?: Child; region?: string }) => (
  <header class="top">
    {children ?? <a class="brand" href="/"><Logo />vlrstats</a>}
    <div class="hrow" style="gap:8px"><MiniSearch /><ThemeToggle /></div>
  </header>
);

export const Footer = () => (
  <footer class="foot">
    <span>Não afiliado à Riot Games.</span>
    <span class="hrow" style="gap:12px"><a href="/desktop">App para PC</a><a href="/llms.txt">llms.txt</a><span class="num">v0.1</span></span>
  </footer>
);

export const SITE = (process.env.SITE_URL ?? 'https://vlrstats.lol').replace(/\/$/, '');
const DESC = 'Busque por Riot ID e veja rank, histórico de partidas e desempenho por agente, mapa e arma.';
/** Share preview (Open Graph): paths are made absolute here. */
export type Og = { title: string; desc?: string; image: string; path: string };

export const Layout: FC<{ title?: string; children: Child; noindex?: boolean; og?: Og }> = ({ title, children, noindex, og }) => (
  <>
    {raw('<!DOCTYPE html>')}
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <script dangerouslySetInnerHTML={{ __html: THEME_JS }} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title ? `${title} · vlrstats` : 'vlrstats · Suas partidas de Valorant, analisadas'}</title>
        <meta name="description" content={og?.desc ?? DESC} />
        <meta property="og:site_name" content="vlrstats" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="pt_BR" />
        <meta property="og:title" content={og?.title ?? 'vlrstats · Suas partidas de Valorant, analisadas'} />
        <meta property="og:description" content={og?.desc ?? DESC} />
        <meta property="og:url" content={`${SITE}${og?.path ?? '/'}`} />
        <meta property="og:image" content={`${SITE}${og?.image ?? '/og/site.png'}`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        {noindex && <meta name="robots" content="noindex" />}
        <meta name="theme-color" content="#f8f6f2" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1f1d1a" media="(prefers-color-scheme: dark)" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://media.valorant-api.com" crossorigin="" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" />
        <link rel="stylesheet" href={`/styles.css?v=${ASSET_V}`} />
        <script src={`/app.js?v=${ASSET_V}`} defer></script>
      </head>
      <body>
        <div class="dots" aria-hidden="true"></div>
        {children}
      </body>
    </html>
  </>
);

/** Page shell used by all inner pages. */
export const Shell: FC<{ title?: string; region?: string; head?: Child; og?: Og; children: Child }> = ({ title, region, head, og, children }) => (
  <Layout title={title} og={og}>
    <div class="wrap page">
      <Header region={region}>{head}</Header>
      {children}
    </div>
    <div class="wrap"><Footer /></div>
  </Layout>
);
