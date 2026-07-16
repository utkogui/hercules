# Hércules Fase 2 — Avaliação de escopo

App simples (Node + Express) para avaliar comentários de interface (Bruno / Nathalia) com screenshots, abas e persistência das respostas em JSON.

## Stack

- `server.js` — API + arquivos estáticos
- `public/` — página de apresentação
- `assets/frames/` — screenshots
- `data/respostas.json` — respostas do time (local)

## Local

```bash
npm install
npm start
```

Abre em [http://localhost:3000](http://localhost:3000).

## Deploy no Railway

Projeto já está pronto para *Deploy from GitHub*: sem build step especial, só `npm start`.

### 1. Subir o repositório

Faça push deste projeto para o GitHub (sem a pasta `@ - matilha-ds`).

### 2. Criar o serviço

1. [Railway](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Selecione o repositório
3. Railway detecta Node e usa:
   - **Start:** `npm start` (via `railway.toml` / `Procfile`)
   - **Healthcheck:** `GET /api/health`

Não é necessário configurar `PORT` — o Railway injeta automaticamente.

### 3. Variáveis (opcional, mas recomendado)

| Variável   | Valor  | Quando                          |
|-----------|--------|----------------------------------|
| `DATA_DIR` | `/data` | Depois de criar o Volume (abaixo) |

Sem Volume, as respostas funcionam, mas **somem a cada redeploy**.

### 4. Volume (persistir respostas)

1. No serviço → **Settings** → **Volumes** → **Add Volume**
2. Mount path: `/data`
3. Em **Variables**, adicione:

```
DATA_DIR=/data
```

4. Redeploy

As respostas ficam em `/data/respostas.json`.

### 5. Domínio

**Settings** → **Networking** → **Generate Domain** (ou domínio custom).

## API

| Método | Rota             | Uso                          |
|--------|------------------|------------------------------|
| `GET`  | `/api/health`    | Healthcheck                   |
| `GET`  | `/api/respostas` | Lê o JSON salvo               |
| `PUT`  | `/api/respostas` | Salva `{ "answers": { ... } }` |

A página salva automaticamente ao preencher os formulários e também permite **Exportar JSON**.

## Estrutura relevante

```
├── server.js
├── package.json
├── Procfile
├── railway.toml
├── .env.example
├── public/           # UI (index.html + brand)
├── assets/frames/    # screenshots
└── data/             # fallback local das respostas
```
