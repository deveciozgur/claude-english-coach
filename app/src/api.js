async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data;
}

export const api = {
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
