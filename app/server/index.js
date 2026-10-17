import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateFeedback, llmConfigured } from './feedback.js';
import {
  DATA_DIR,
  appendVocabulary,
  completeActivity,
  completeQuickPlay,
  dailyLoot,
  setMode,
  dueVocabulary,
  listSessions,
  logErrors,
  migrateFiles,
  readErrors,
  readProfile,
  readSession,
  readVocabulary,
  reviewVocabulary,
  writeProfile,
} from './store.js';

const PORT = Number(process.env.PORT ?? 3001);
const WARMUP_MAX = 6; // CLAUDE.md section 1: at most 6 due words in the 3-minute warm-up
const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(here, '..', 'dist');

const app = express();
app.use(express.json({ limit: '1mb' }));

// Express 5 forwards rejected promises to the error handler.
app.get('/api/health', (req, res) => res.json({ ok: true, dataDir: DATA_DIR, llm: llmConfigured() }));

app.get('/api/profile', async (req, res) => res.json(await readProfile()));
app.put('/api/profile', async (req, res) => {
  await writeProfile(req.body);
  res.json(await readProfile());
});

app.get('/api/vocabulary', async (req, res) => res.json(await readVocabulary()));
app.get('/api/vocabulary/due', async (req, res) => res.json(await dueVocabulary(Math.min(WARMUP_MAX, Number(req.query.limit) || WARMUP_MAX))));
app.post('/api/vocabulary/review', async (req, res) => res.json(await reviewVocabulary(req.body?.original, req.body?.grade ?? req.body?.result)));
app.post('/api/vocabulary', async (req, res) => {
  const entries = Array.isArray(req.body) ? req.body : [req.body];
  res.status(201).json(await appendVocabulary(entries));
});

app.get('/api/errors', async (req, res) => res.json(await readErrors()));
app.post('/api/errors', async (req, res) => {
  const entries = Array.isArray(req.body) ? req.body : [req.body];
  res.status(201).json(await logErrors(entries));
});

app.get('/api/sessions', async (req, res) => res.json(await listSessions()));
app.get('/api/sessions/:date', async (req, res) => res.type('text/markdown').send(await readSession(req.params.date)));

app.post('/api/feedback', async (req, res) => {
  const { mode, text } = req.body ?? {};
  if (!['writing', 'speaking'].includes(mode) || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'mode (writing|speaking) and non-empty text are required' });
  }
  res.json(await generateFeedback(req.body));
});

app.post('/api/activity', async (req, res) => res.json(await completeActivity(req.body ?? {})));
app.post('/api/quickplay', async (req, res) => res.json(await completeQuickPlay(req.body ?? {})));
app.post('/api/mode', async (req, res) => res.json(await setMode(req.body?.mode)));
app.get('/api/loot', async (req, res) => res.json(await dailyLoot(req.query.date ?? undefined)));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('/{*splat}', (req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

app.use((err, req, res, next) => {
  const status = err.status ?? (err.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message });
});

const migrated = await migrateFiles();
if (migrated.length) console.log(`Migrated to the current schema: ${migrated.join(', ')}`);

app.listen(PORT, () => {
  console.log(`English Coach API on http://localhost:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Feedback engine: ${llmConfigured() ? 'Claude API' : 'offline heuristics (set ANTHROPIC_API_KEY for Claude feedback)'}`);
});
