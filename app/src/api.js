async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : await res.text();
  if (res.status === 401 && data?.locked) window.dispatchEvent(new Event('apex:locked'));
  if (!res.ok) throw Object.assign(new Error(data?.error ?? `Request failed (${res.status})`), { status: res.status });
  return data;
}

export const api = {
  authStatus: () => request('/auth/status'),
  login: (pin) => request('/auth/login', { method: 'POST', body: { pin } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  state: () => request('/state'),
  health: () => request('/health'),
  profile: () => request('/profile'),
  saveProfile: (profile) => request('/profile', { method: 'PUT', body: profile }),
  vocabulary: () => request('/vocabulary'),
  addVocabulary: (entries) => request('/vocabulary', { method: 'POST', body: entries }),
  dueVocabulary: () => request('/vocabulary/due'),
  reviewVocabulary: (original, grade) => request('/vocabulary/review', { method: 'POST', body: { original, grade } }),
  errors: () => request('/errors'),
  sessions: () => request('/sessions'),
  session: (date) => request(`/sessions/${date}`),
  feedback: (payload) => request('/feedback', { method: 'POST', body: payload }),
  completeActivity: (payload) => request('/activity', { method: 'POST', body: payload }),
  quickPlay: (payload) => request('/quickplay', { method: 'POST', body: payload }),
  setMode: (mode) => request('/mode', { method: 'POST', body: { mode } }),
  loot: () => request('/loot'),
};

/**
 * Streams a coach reply from /api/chat (Server-Sent Events). Calls onText for every chunk and
 * resolves when the reply is complete. Pass an AbortSignal to stop it.
 */
export async function streamChat(messages, { onText, signal } = {}) {
  const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages }), signal });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && data.locked) window.dispatchEvent(new Event('apex:locked'));
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
