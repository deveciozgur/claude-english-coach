// The app's data layer. On shared hosting there is no Node server: the coach logic (SM-2, sub-bands,
// error ledger, sessions) runs here in the browser on the files api.php serves, and every change is
// written straight back to the host's disk. AI calls go through api.php to Gemini.

import * as store from '@/lib/core/store';
import { generateFeedback } from '@/lib/core/feedback';
import { ApiError, ENDPOINT, RemoteFS, call } from '@/lib/remote-fs';

type AuthStatus = { required: boolean; authenticated: boolean; ai: boolean; model: string; version: string };

const files = new RemoteFS();
store.useFileSystem(files);

let aiReady = false;
let loading: Promise<void> | null = null;
const ready = () => (files.loaded ? Promise.resolve() : (loading ??= files.load().finally(() => (loading = null))));

// One operation at a time: run it on the in-memory files, then save. If another device saved in the
// meantime (409), reload the latest files and run the operation once more on top of them.
let queue: Promise<unknown> = Promise.resolve();
function mutate<T>(op: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    await ready();
    try {
      const result = await op();
      await files.flush();
      return result;
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 409)) throw err;
      await files.load();
      const result = await op();
      await files.flush();
      return result;
    }
  });
  queue = run.catch(() => {});
  return run;
}

const read = async <T>(op: () => Promise<T>): Promise<T> => {
  await ready();
  return op();
};

/** Picks up changes made on another device when the tab comes back into view. */
export function refreshOnFocus(onChange: () => void) {
  const handler = () => {
    if (document.visibilityState !== 'visible' || !files.loaded || files.hasUnsaved) return;
    files.load().then(onChange, () => {});
  };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}

const askJson = (req: { prompt: string; schema: unknown }) => call<{ text: string; model?: string }>('feedback', req);

export const api = {
  async authStatus() {
    const s = await call<AuthStatus>('auth_status');
    aiReady = s.ai;
    return s;
  },
  verify: (pin: string) => call('verify', { pin }),
  async logout() {
    await call('logout', {});
    files.loaded = false;
  },
  health: () => call<AuthStatus>('auth_status').then((s) => ({ ok: true, llm: s.ai, model: s.model, version: s.version })),

  state: () => read(async () => ({ profile: await store.readProfile(), vocabulary: await store.readVocabulary(), errors: await store.readErrors() })),
  profile: () => read(() => store.readProfile()),
  saveProfile: (profile) => mutate(() => store.writeProfile(profile)),
  vocabulary: () => read(() => store.readVocabulary()),
  addVocabulary: (entries) => mutate(() => store.appendVocabulary(Array.isArray(entries) ? entries : [entries])),
  /** At most 6 due words for the warm-up (CLAUDE.md section 1); the Vault review may go through 50. */
  dueVocabulary: (scope: 'warmup' | 'vault' = 'warmup') => read(() => store.dueVocabulary(scope === 'vault' ? 50 : 6)),
  /** grade: SM-2 quality 0-5, or again | hard | good | easy */
  reviewVocabulary: (original: string, grade: string | number) => mutate(() => store.reviewVocabulary(original, grade)),
  errors: () => read(() => store.readErrors()),
  sessions: () => read(() => store.listSessions()),
  session: (date: string) => read(() => store.readSession(date)),
  feedback: (payload) => read(() => generateFeedback(payload, aiReady ? askJson : null)),
  completeActivity: (payload) => mutate(() => store.completeActivity(payload ?? {})),
  quickPlay: (payload) => mutate(() => store.completeQuickPlay(payload ?? {})),
  setMode: (mode: string) => mutate(() => store.setMode(mode)),
  loot: () => read(() => store.dailyLoot()),
};

/**
 * Streams a coach reply from api.php (?action=chat, Server-Sent Events relayed from Gemini).
 * Calls onText for every chunk and resolves when the reply is complete. Pass an AbortSignal to stop it.
 */
export async function streamChat(messages: { role: string; content: string }[], { onText, signal }: { onText?: (t: string) => void; signal?: AbortSignal } = {}) {
  await ready();
  const res = await fetch(`${ENDPOINT}?action=chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'lumos' },
    body: JSON.stringify({ messages, context: await chatContext() }),
    signal,
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && data.locked) window.dispatchEvent(new Event('lumos:locked'));
    throw new Error(data.error ?? `İstek başarısız (${res.status})`);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const events = buffer.split('\n\n');
    buffer = events.pop();
    for (const ev of events) {
      const line = ev.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue;
      const data = JSON.parse(line.slice(6));
      if (data.error) throw new Error(data.error);
      if (data.text) onText?.(data.text);
    }
  }
}

/** The learner's current state for the coach's system instruction (api.php adds it after CLAUDE.md). */
async function chatContext() {
  const [profile, errors, due] = await Promise.all([store.readProfile(), store.readErrors(), store.dueVocabulary(6)]);
  const g = profile.gamification;
  return JSON.stringify({
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
  });
}
