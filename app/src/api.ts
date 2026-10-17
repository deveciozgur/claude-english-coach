type RequestOptions = { method?: string; body?: unknown };

async function request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: options.method,
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : await res.text();
  if (res.status === 401 && data?.locked) window.dispatchEvent(new Event('lumos:locked'));
  if (!res.ok) throw Object.assign(new Error(data?.error ?? `Request failed (${res.status})`), { status: res.status });
  return data;
}

export const api = {
  authStatus: () => request<{ required: boolean; authenticated: boolean }>('/auth/status'),
  verify: (pin: string) => request('/auth/verify', { method: 'POST', body: { pin } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  health: () => request<{ ok: boolean; llm: boolean; version: string; model: string }>('/health'),
  state: () => request('/state'),
  profile: () => request('/state/profile'),
  saveProfile: (profile) => request('/state/profile', { method: 'PUT', body: profile }),
  vocabulary: () => request('/state/vocabulary'),
  addVocabulary: (entries) => request('/state/vocabulary', { method: 'POST', body: entries }),
  dueVocabulary: (scope: 'warmup' | 'vault' = 'warmup') => request(`/state/vocabulary/due${scope === 'vault' ? '?scope=vault' : ''}`),
  /** grade: SM-2 quality 0-5, or again | hard | good | easy */
  reviewVocabulary: (original: string, grade: string | number) => request('/state/vocabulary/review', { method: 'POST', body: { original, grade } }),
  errors: () => request('/state/errors'),
  sessions: () => request<string[]>('/state/sessions'),
  session: (date: string) => request<string>(`/state/sessions/${date}`),
  feedback: (payload) => request('/feedback', { method: 'POST', body: payload }),
  completeActivity: (payload) => request('/state/activity', { method: 'POST', body: payload }),
  quickPlay: (payload) => request('/state/quickplay', { method: 'POST', body: payload }),
  setMode: (mode: string) => request('/state/mode', { method: 'POST', body: { mode } }),
  loot: () => request('/state/loot'),
};

/**
 * Streams a coach reply from /api/chat (Server-Sent Events). Calls onText for every chunk and
 * resolves when the reply is complete. Pass an AbortSignal to stop it.
 */
export async function streamChat(messages: { role: string; content: string }[], { onText, signal }: { onText?: (t: string) => void; signal?: AbortSignal } = {}) {
  const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages }), signal });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && data.locked) window.dispatchEvent(new Event('lumos:locked'));
    throw new Error(data.error ?? `Request failed (${res.status})`);
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
