# Hércules Fase 2 — Avaliação de escopo

App simples (Node + Express) para avaliar comentários de interface (Bruno / Nathalia), com screenshots, abas e persistência das respostas em JSON.

## Links

| Quem | URL | Acesso |
|------|-----|--------|
| **Cliente** | `/` (ou `/cliente`) | Público. Vê o resumo das avaliações e escreve **Considerações / Dúvidas** (campo só do cliente) |
| **Time Matilha** | `/time` | Soft login (só senha). Edita avaliações e lê o feedback do cliente em cada comentário |

Salvar avaliações (`PUT /api/respostas`) exige cookie de sessão após o login. O texto do cliente fica em `consideracoes` e não sobrescreve a avaliação do time.

## Local

```bash
npm install
npm start
```

- Cliente: [http://localhost:3000/](http://localhost:3000/)
- Time: [http://localhost:3000/time](http://localhost:3000/time) — senha padrão `Matilha0108`

## Deploy no Railway

### 1. Push do repositório

GitHub sem a pasta `@ - matilha-ds` (já no `.gitignore`).

### 2. Criar o serviço

1. Railway → **New Project** → **Deploy from GitHub repo**
2. Selecione o repositório
3. Start: `npm start` · Healthcheck: `GET /api/health`

### 3. Variáveis

| Variável | Exemplo | Obrigatório |
|----------|---------|-------------|
| `TEAM_PASSWORD` | `Matilha0108` | Não (esse é o padrão) |
| `AUTH_SECRET` | segredo longo | Não |
| `DATA_DIR` | `/data` | Sim, se usar Volume |

### 4. Volume (persistir respostas)

1. **Settings** → **Volumes** → mount `/data`
2. Variable: `DATA_DIR=/data`
3. Redeploy

### 5. Domínio e links para enviar

Depois do **Generate Domain**:

- Cliente: `https://SEU-DOMINIO.up.railway.app/`
- Time: `https://SEU-DOMINIO.up.railway.app/time` (senha soft login)

A aba Bruno é o padrão e **não** aparece como `#bruno` no link. Só a aba Nathalia usa `#nathalia` se o cliente trocar de aba.

## API

| Método | Rota | Quem |
|--------|------|------|
| `GET` | `/api/health` | Público |
| `GET` | `/api/respostas` | Público (leitura) |
| `PUT` | `/api/consideracoes` | Público (só campo de considerações) |
| `POST` | `/api/auth/login` | Soft login da equipe |
| `POST` | `/api/auth/logout` | Encerra sessão |
| `GET` | `/api/auth/status` | Verifica cookie |
| `PUT` | `/api/respostas` | Só equipe autenticada |

## Estrutura

```
├── server.js
├── package.json
├── Procfile
├── railway.toml
├── .env.example
├── public/index.html   # servido via /, /cliente e /time
├── public/assets/brand
├── assets/frames/
└── data/
```
