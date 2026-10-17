import './env.js'; // must stay first: loads .env before other modules read process.env
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertAuthConfigured, mountAuth } from './auth.js';
import { streamChat } from './chat.js';
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
  updateProfile,
  writeProfile,
} from './store.js';

const PORT = Number(process.env.PORT ?? 3001);
const WARMUP_MAX = 6; // CLAUDE.md section 1: at most 6 due words in the 3-minute warm-up
const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(here, '..', 'dist');

assertAuthConfigured();

const app = express();
app.disable('x-powered-by');
// Behind Nginx/Apache/Passenger: trust the first proxy so req.ip and req.secure (Secure cookie) are right.
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use(express.json({ limit: '1mb' }));

mountAuth(app); // everything below under /api needs the PIN session

// Express 5 forwards rejected promises to the error handler.
app.get('/api/health', (req, res) => res.json({ ok: true, dataDir: DATA_DIR, llm: llmConfigured() }));

// The learner's whole state from the server disk in one call, and a single write path for it.
const readState = async () => {
  const [profile, vocabulary, errors] = await Promise.all([readProfile(), readVocabulary(), readErrors()]);
  return { profile, vocabulary, errors };
};
app.get('/api/state', async (req, res) => res.json(await readState()));
app.put('/api/state', async (req, res) => {
  const { profile, vocabulary, errors } = req.body ?? {};
  if (profile) await updateProfile(profile); // partial update, validated against the profile.json schema
  if (Array.isArray(vocabulary) && vocabulary.length) await appendVocabulary(vocabulary); // new words start at 2.50 / 0 / 1d
  if (Array.isArray(errors) && errors.length) await logErrors(errors);
  res.json(await readState());
});

app.post('/api/chat', streamChat);

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
  app.use(express.static(DIST, { index: false, maxAge: '1y', immutable: true, setHeaders: (res, file) => file.endsWith('.html') && res.setHeader('Cache-Control', 'no-cache') }));
  app.get('/{*splat}', (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(DIST, 'index.html')));
}

app.use((err, req, res, next) => {
  const status = err.status ?? (err.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message });
});

const migrated = await migrateFiles();
if (migrated.length) console.log(`Migrated to the current schema: ${migrated.join(', ')}`);

app.listen(PORT, process.env.HOST ?? '0.0.0.0', () => {
  console.log(`English Coach API on http://localhost:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Feedback engine: ${llmConfigured() ? 'Claude API' : 'offline heuristics (set ANTHROPIC_API_KEY for Claude feedback)'}`);
});
