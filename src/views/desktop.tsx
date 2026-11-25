import { Icon, Shell } from './ui.js';

/** The release the download button points at. Update with each new exe. */
export const DESKTOP = {
  version: '1.0.0',
  size: '14 MB',
  releases: 'https://github.com/TomazMPP/vlrstats/releases',
  file: 'https://github.com/TomazMPP/vlrstats/releases/latest/download/vlrstats-desktop.exe',
};

const FEATURES = [
  ['Placar ao vivo', 'Rank, pico, RR, K/D, HS% e win rate dos dez jogadores assim que a partida carrega.'],
  ['Quem já cruzou com você', 'Todo jogador das suas partidas, cada um a um clique do perfil no vlrstats.lol.'],
  ['Depois da partida', 'O resumo de cada partida, com o desempenho de todo mundo.'],
  ['Instalock por mapa', 'Escolha um agente para cada mapa e ele é travado na seleção. Vem desligado.'],
] as const;

const Ext = ({ href, children }: { href: string; children: string }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" class="lnk">{children}</a>
);

export const DesktopPage = () => (
  <Shell title="App para PC" og={{
    title: 'vlrstats desktop · o vlrstats durante a partida',
    desc: 'App grátis para Windows: o rank de todo mundo da partida, quem já jogou com você e instalock por mapa.',
    image: '/og/site.png', path: '/desktop',
  }}>
    <main class="dsk">
      <div class="hero in">
        <h1 class="title">vlrstats desktop</h1>
        <p>O vlrstats aberto do lado do jogo: o rank de todo mundo da partida, quem já jogou com você e, se quiser, seu agente travado sozinho em cada mapa.</p>
      </div>

      <div class="dsk-get in" style="--d:80ms">
        <a class="btn btn-ink btn-lg" href="/desktop/download">
          <Icon name="down" />Baixar para Windows
        </a>
        <p class="small muted num">Grátis · v{DESKTOP.version} · {DESKTOP.size} · Windows 10 e 11 · por <Ext href="https://x.com/tmppbr">@tmppbr</Ext></p>
      </div>

      <div class="alert in" style="--d:120ms" role="note">
        <Icon name="alert" />
        <p class="sub" style="color:var(--fg)">
          A Riot já suspendeu por 2 semanas contas que usaram instalock. Use por sua conta e risco: o placar e o histórico funcionam com ele desligado. App não oficial, sem vínculo com a Riot Games.
        </p>
      </div>

      <section class="in" style="--d:160ms">
        <div class="sh"><h2>O que vem nele</h2></div>
        <div class="card clip">
          {FEATURES.map(([name, what]) => (
            <div class="dsk-row">
              <b>{name}</b>
              <span class="sub">{what}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div class="sh"><h2>Como usar</h2></div>
        <ol class="dsk-steps">
          <li><span><b>Baixe</b> o <span translate="no">vlrstats-desktop.exe</span>.</span></li>
          <li><span><b>Abra o VALORANT</b> e espere chegar no menu.</span></li>
          <li><span><b>Dê dois cliques no arquivo.</b> Não precisa instalar nada, nem Python.</span></li>
        </ol>
        <p class="small muted" style="margin-top:12px">Abriu o app antes do jogo? Feche e abra de novo com o VALORANT já no menu.</p>
      </section>

      <section>
        <div class="sh"><h2>Se algo der errado</h2></div>
        <div class="dsk-faq">
          <div class="dsk-row"><b>“O Windows protegeu o computador”</b><span class="sub">O arquivo ainda não tem assinatura digital, então o Windows avisa na primeira vez. Clique em <b>Mais informações</b> e depois em <b>Executar assim mesmo</b>.</span></div>
          <div class="dsk-row"><b>O antivírus reclamou</b><span class="sub">Programas em Python num exe só às vezes levam alarme falso. Baixe só por aqui ou pela <Ext href={DESKTOP.releases}>página de versões</Ext>, que traz o SHA-256 de cada arquivo.</span></div>
          <div class="dsk-row"><b>A janela ficou em branco</b><span class="sub">Falta o WebView2 da Microsoft, que já vem no Windows 11. Instale o <Ext href="https://developer.microsoft.com/microsoft-edge/webview2/">WebView2 Runtime</Ext> e abra de novo.</span></div>
          <div class="dsk-row"><b>Nomes escondidos</b><span class="sub">Para revelar nomes ocultos e ver nomes antigos, cole uma chave grátis da <Ext href="https://docs.henrikdev.xyz/">HenrikDev</Ext> na aba Agents do app.</span></div>
          <div class="dsk-row"><b>Desinstalar</b><span class="sub">Apague o exe e a pasta <span class="num" translate="no">%APPDATA%\vlrstats desktop</span>, onde ficam suas configurações.</span></div>
        </div>
      </section>
    </main>
  </Shell>
);
