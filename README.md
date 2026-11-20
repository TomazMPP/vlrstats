# vlrstats

Tracker pessoal de Valorant: busca por Riot ID, perfil, histórico de partidas,
estatísticas e detalhe de partida. Renderizado no servidor (Hono + JSX), quase
sem JavaScript no cliente, com cache em SQLite (`node:sqlite`).

## Rodar

Requer Node 22.13+.

```sh
cp .env.example .env   # preencha HENRIK_API_KEY
npm install
npm run dev            # http://localhost:3000
```

Produção: `npm run build && npm start`.

## Como os dados são usados

- Partidas finalizadas são guardadas compactadas (~3 KB) e nunca buscadas de novo.
- Rank, histórico de RR e lista de partidas ficam 5 min em cache; se a API
  falhar, a última cópia é servida e a página avisa.
- **MMR estimado**: a Riot não expõe o MMR. Usamos o rank médio dos outros 9
  jogadores das partidas competitivas recentes (o matchmaking monta o lobby em
  volta do MMR) e a média de RR ganho/perdido.
