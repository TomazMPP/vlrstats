import { Icon, Shell } from './ui.js';

export const NotFound = ({ what, riotid }: { what: 'player' | 'match' | 'page'; riotid?: string }) => (
  <Shell title="Não encontrado">
    <main class="state in">
      <span class="ic"><Icon name={what === 'player' ? 'user' : 'info'} size={18} /></span>
      <h1 class="title" style="font-size:22px">
        {what === 'player' ? 'Nenhum jogador com esse Riot ID' : what === 'match' ? 'Partida não encontrada' : 'Página não encontrada'}
      </h1>
      <p class="sub">
        {what === 'player'
          ? <>Confira o nome, o TAG e a região{riotid ? <> de <span translate="no" class="num">{riotid}</span></> : null}. Contas que nunca jogaram ou que trocaram de nome recentemente podem não aparecer.</>
          : 'O link pode estar errado ou a partida ainda não foi processada.'}
      </p>
      <a class="btn" href="/"><Icon name="back" size={14} />Nova busca</a>
    </main>
  </Shell>
);

export const RateLimited = ({ wait, retry }: { wait: number; retry: string }) => (
  <Shell title="Aguarde">
    <main class="state in">
      <span class="ic"><Icon name="clock" size={18} /></span>
      <h1 class="title" style="font-size:22px">Muitas buscas seguidas</h1>
      <p class="sub num">Tentando de novo em <span id="s">{wait}</span> s.</p>
      <a class="btn" href={retry}>Tentar agora</a>
      <script dangerouslySetInnerHTML={{
        __html: `(()=>{let s=${Math.max(1, wait)};const e=document.getElementById('s');const t=setInterval(()=>{s--;e.textContent=s;if(s<=0){clearInterval(t);location.reload()}},1000)})()`,
      }} />
    </main>
  </Shell>
);

export const ApiFailure = ({ retry }: { retry: string }) => (
  <Shell title="Erro">
    <main class="state in">
      <div class="alert" role="alert" style="width:100%">
        <Icon name="alert" />
        <div class="col" style="gap:10px">
          <p style="font-weight:500">Erro na API. Avise o Tomaz que esse erro aconteceu.</p>
          <a class="btn" href={retry} style="align-self:flex-start"><Icon name="refresh" size={14} />Tentar de novo</a>
        </div>
      </div>
    </main>
  </Shell>
);
