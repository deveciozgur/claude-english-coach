// Free-form coaching chat, streamed to the browser as Server-Sent Events.
// The system prompt is CLAUDE.md plus a snapshot of the learner's files, so the coach
// always starts from the current sub-bands, streak, XP, due words and polish patterns.

import { MODEL, getClient, llmConfigured } from './feedback.js';
import { dueVocabulary, readCoachInstructions, readErrors, readProfile } from './store.js';

const MAX_TURNS = 24;
const MAX_CHARS = 6000;

async function systemPrompt() {
  const [instructions, profile, errors, due] = await Promise.all([readCoachInstructions(), readProfile(), readErrors(), dueVocabulary(6)]);
  const g = profile.gamification;
  const snapshot = {
    overall: profile.sub_band,
    skill_bands: profile.skill_bands,
    can_do_mastered: profile.can_do_mastered.map((c) => c.id),
    streak_days: g.streak_days,
    xp_total: g.xp_total,
    confidence_index: g.confidence_index,
    mode: g.mode,
    struggle_streak: g.struggle_streak,
    interests: profile.interests,
    due_words: due.map((d) => d.original),
    active_polish_patterns: errors.active.slice(0, 5).map((e) => `${e.before} -> ${e.after}`),
  };
  return `${instructions || 'You are Apex, an English coach and CEFR assessor.'}

---
## Current learner state (read from the files on the server)
\`\`\`json
${JSON.stringify(snapshot, null, 2)}
\`\`\`
This is a chat in the Apex web app. The app saves tasks, warm-up reviews and scores to the files itself; in this chat, coach and practise. Answer in English at the learner's level; add short Turkish help only when it unblocks them.`;
}

/** Keeps the last turns, trims long messages and makes sure the history starts with the learner. */
function cleanMessages(raw) {
  const msgs = (Array.isArray(raw) ? raw : [])
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  return msgs;
}

export async function streamChat(req, res) {
  const messages = cleanMessages(req.body?.messages);
  if (!messages.length || messages.at(-1).role !== 'user') return res.status(400).json({ error: 'messages must end with a user message' });
  if (!llmConfigured()) return res.status(503).json({ error: 'The AI coach is offline: set ANTHROPIC_API_KEY in app/.env on the server.' });

  const system = await systemPrompt();
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const stream = getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    messages,
  });
  let closed = false;
  res.on('close', () => {
    closed = true;
    stream.abort();
  });
  stream.on('text', (text) => send({ text }));
  stream.on('error', () => {}); // surfaced through finalMessage() below

  try {
    const final = await stream.finalMessage();
    send({ done: true, stop_reason: final.stop_reason });
  } catch (err) {
    if (!closed) {
      console.error('Chat stream failed:', err.message);
      send({ error: 'The coach could not answer just now. Please try again.' });
    }
  }
  res.end();
}
