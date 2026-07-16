const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
// No Railway: monte um Volume e defina DATA_DIR=/data para persistir entre deploys.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const RESPONSES_FILE = path.join(DATA_DIR, 'respostas.json');

app.use(express.json({ limit: '2mb' }));
app.use('/assets/frames', express.static(path.join(__dirname, 'assets', 'frames')));
app.use(express.static(path.join(__dirname, 'public')));

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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/respostas', (_req, res) => {
  res.json(readResponses());
});

app.put('/api/respostas', (req, res) => {
  const body = req.body || {};
  const answers = body.answers || body;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return res.status(400).json({ error: 'Payload inválido. Envie { answers: { ... } }.' });
  }
  const saved = writeResponses({ answers });
  res.json(saved);
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

ensureDataFile();
app.listen(PORT, () => {
  console.log(`Hércules avaliação rodando em http://localhost:${PORT}`);
  console.log(`Respostas em: ${RESPONSES_FILE}`);
});
