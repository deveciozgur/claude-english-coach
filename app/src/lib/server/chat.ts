// Free-form coaching chat, streamed to the browser as Server-Sent Events.
// The system prompt is CLAUDE.md plus a snapshot of the learner's files, so the coach
// always starts from the current sub-bands, streak, XP, due words and polish patterns.

import 'server-only';

import { MODEL, getClient, llmConfigured } from './feedback.ts';
import { dueVocabulary, readCoachInstructions, readErrors, readProfile } from './store.ts';

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
  return `${instructions || 'You are Lumos, an English coach and CEFR assessor.'}

---
## Current learner state (read from the files on the server)
\`\`\`json
${JSON.stringify(snapshot, null, 2)}
\`\`\`
This is a chat in the Lumos web app. The app saves tasks, warm-up reviews and scores to the files itself; in this chat, coach and practise. Answer in English at the learner's level; add short Turkish help only when it unblocks them.`;
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

/** Keeps the last turns, trims long messages and makes sure the history starts with the learner. */
function cleanMessages(raw: unknown): ChatMessage[] {
  const msgs = (Array.isArray(raw) ? raw : [])
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }) as ChatMessage);
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  return msgs;
}

const json = (status: number, body: unknown) => Response.json(body, { status });

/**
 * Streams a coach reply as Server-Sent Events: `data: {"text": "..."}` chunks, then `{"done": true}`
 * (or `{"error": "..."}`). Aborting the request (client gone) aborts the Claude stream.
 */
export async function streamChat(body: { messages?: unknown } | null, signal: AbortSignal): Promise<Response> {
  const messages = cleanMessages(body?.messages);
  if (!messages.length || messages.at(-1).role !== 'user') return json(400, { error: 'messages must end with a user message' });
  if (!llmConfigured()) return json(503, { error: 'The AI coach is offline: set ANTHROPIC_API_KEY in .env on the server.' });

  const system = await systemPrompt();
  const stream = getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    messages,
  });
  signal.addEventListener('abort', () => stream.abort());

  const encoder = new TextEncoder();
  const body$ = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: unknown) => {
        if (!signal.aborted) controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      stream.on('text', (text) => send({ text }));
      stream.on('error', () => {}); // surfaced through finalMessage() below
      stream
        .finalMessage()
        .then((final) => send({ done: true, stop_reason: final.stop_reason }))
        .catch((err) => {
          if (signal.aborted) return;
          console.error('Chat stream failed:', err.message);
          send({ error: 'The coach could not answer just now. Please try again.' });
        })
        .finally(() => {
          try {
            controller.close();
          } catch {
            // already closed by cancel()
          }
        });
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body$, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' },
  });
}
