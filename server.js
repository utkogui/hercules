const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
// No Railway: monte um Volume e defina DATA_DIR=/data para persistir entre deploys.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const RESPONSES_FILE = path.join(DATA_DIR, 'respostas.json');
const TEAM_PASSWORD = process.env.TEAM_PASSWORD || 'Matilha0108';
const AUTH_SECRET = process.env.AUTH_SECRET || TEAM_PASSWORD;
const COOKIE_NAME = 'hercules_equipe';
const APP_HTML = path.join(__dirname, 'public', 'index.html');

app.use(express.json({ limit: '2mb' }));

// Apenas assets públicos — o HTML NÃO fica exposto em /index.html
app.use('/assets/frames', express.static(path.join(__dirname, 'assets', 'frames')));
app.use('/assets/brand', express.static(path.join(__dirname, 'public', 'assets', 'brand')));

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(RESPONSES_FILE)) {
    fs.writeFileSync(
      RESPONSES_FILE,
      JSON.stringify({ updatedAt: null, answers: {} }, null, 2),
      'utf8'
    );
  }
}

function readResponses() {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(RESPONSES_FILE, 'utf8'));
  } catch {
    return { updatedAt: null, answers: {} };
  }
}

function writeResponses(payload) {
  ensureDataFile();
  const next = {
    updatedAt: new Date().toISOString(),
    answers: payload.answers || payload || {},
  };
  fs.writeFileSync(RESPONSES_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function sessionToken() {
  return crypto.createHmac('sha256', AUTH_SECRET).update('equipe-session-v1').digest('hex');
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  String(header)
    .split(';')
    .forEach((part) => {
      const i = part.indexOf('=');
      if (i < 0) return;
      const k = part.slice(0, i).trim();
      const v = part.slice(i + 1).trim();
      if (k) out[k] = decodeURIComponent(v);
    });
  return out;
}

function isTeamAuthed(req) {
  const cookies = parseCookies(req.headers.cookie);
  return timingSafeEqualStr(cookies[COOKIE_NAME] || '', sessionToken());
}

function setAuthCookie(res) {
  const secure = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production');
  const maxAge = 60 * 60 * 24 * 14; // 14 dias
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(sessionToken())}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push('Secure');
  res.set('Set-Cookie', parts.join('; '));
}

function clearAuthCookie(res) {
  const secure = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production');
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (secure) parts.push('Secure');
  res.set('Set-Cookie', parts.join('; '));
}

/** Soft auth: cookie de sessão após login com senha. */
function teamAuth(req, res, next) {
  if (isTeamAuthed(req)) return next();
  return res.status(401).json({ error: 'Não autenticado' });
}

function sendApp(res, view) {
  let html = fs.readFileSync(APP_HTML, 'utf8');
  // Cliente: remove o gate de senha do HTML. Equipe: mantém.
  if (view !== 'equipe') {
    html = html.replace(
      /<div class="login-gate"[\s\S]*?<form class="login-card"[\s\S]*?<\/form>\s*<\/div>\s*/,
      ''
    );
  }
  const inject = `<script>window.__VIEW__=${JSON.stringify(view)};</script>`;
  if (html.includes('</head>')) {
    html = html.replace('</head>', `${inject}\n</head>`);
  } else {
    html = inject + html;
  }
  res.set('Cache-Control', 'no-store');
  res.type('html').send(html);
}

/** Preserva considerações do cliente ao salvar avaliações da equipe. */
function mergeTeamAnswers(incoming) {
  const current = readResponses();
  const merged = {};
  for (const [id, ans] of Object.entries(incoming || {})) {
    if (!ans || typeof ans !== 'object') continue;
    merged[id] = { ...ans };
    if (merged[id].consideracoes === undefined && current.answers[id]?.consideracoes) {
      merged[id].consideracoes = current.answers[id].consideracoes;
    }
  }
  return writeResponses({ answers: merged });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/auth/status', (req, res) => {
  res.json({ ok: isTeamAuthed(req) });
});

app.post('/api/auth/login', (req, res) => {
  const password = String((req.body && req.body.password) || '');
  if (!timingSafeEqualStr(password, TEAM_PASSWORD)) {
    return res.status(401).json({ error: 'Senha incorreta' });
  }
  setAuthCookie(res);
  res.json({ ok: true });
});

app.post('/api/auth/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// Cliente (e equipe) podem ler as respostas
app.get('/api/respostas', (_req, res) => {
  res.json(readResponses());
});

// Somente equipe autenticada pode salvar avaliações
app.put('/api/respostas', teamAuth, (req, res) => {
  const body = req.body || {};
  const answers = body.answers || body;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return res.status(400).json({ error: 'Payload inválido. Envie { answers: { ... } }.' });
  }
  const saved = mergeTeamAnswers(answers);
  res.json(saved);
});

// Cliente pode gravar apenas considerações / dúvidas por item
app.put('/api/consideracoes', (req, res) => {
  const incoming = (req.body && req.body.consideracoes) || req.body || {};
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return res.status(400).json({ error: 'Payload inválido. Envie { consideracoes: { id: "texto" } }.' });
  }
  const data = readResponses();
  for (const [id, text] of Object.entries(incoming)) {
    if (!/^\d+$/.test(String(id))) continue;
    if (!data.answers[id] || typeof data.answers[id] !== 'object') {
      data.answers[id] = {};
    }
    data.answers[id].consideracoes = String(text || '').slice(0, 8000);
  }
  const saved = writeResponses({ answers: data.answers });
  res.json(saved);
});

app.get('/cliente', (_req, res) => sendApp(res, 'cliente'));

// Área da equipe (soft login no front). /time é a rota principal.
app.get('/time', (_req, res) => sendApp(res, 'equipe'));
app.get('/equipe', (_req, res) => res.redirect(302, '/time'));

// Raiz = visão do cliente (URL limpa, sem redirect e sem #bruno)
app.get('/', (_req, res) => sendApp(res, 'cliente'));

// Bloqueia acesso direto ao HTML estático antigo
app.get(['/index.html', '/equipe.html', '/cliente.html', '/time.html'], (_req, res) => {
  res.redirect(302, '/');
});

app.use((_req, res) => {
  res.redirect(302, '/');
});

ensureDataFile();
app.listen(PORT, () => {
  console.log(`Hércules avaliação em http://localhost:${PORT}`);
  console.log(`  Cliente (público):  http://localhost:${PORT}/  ou /cliente`);
  console.log(`  Time (soft login):  http://localhost:${PORT}/time`);
  console.log(`Respostas: ${RESPONSES_FILE}`);
});
