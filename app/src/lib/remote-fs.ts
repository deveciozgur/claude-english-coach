// The coach files as the browser sees them: loaded once from api.php (?action=get_state), changed in
// memory by the store, and written back (?action=save_state) after every operation. A version number
// guards against two devices overwriting each other: on a conflict the store reloads and re-runs.

import type { StateFS } from './core/store';

export const ENDPOINT = 'api.php';

export class ApiError extends Error {
  status: number;
  locked: boolean;
  constructor(message: string, status: number, locked = false) {
    super(message);
    this.status = status;
    this.locked = locked;
  }
}

/** Calls api.php. POST bodies are JSON; the custom header blocks cross-site form posts. */
export async function call<T = any>(action: string, body?: unknown, query: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ action, ...query });
  const res = await fetch(`${ENDPOINT}?${qs}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'X-Requested-With': 'lumos', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && data?.locked) window.dispatchEvent(new Event('lumos:locked'));
    throw new ApiError(data?.error ?? (res.status === 404 ? 'api.php, index.html ile aynı klasörde bulunamadı' : `İstek başarısız (${res.status})`), res.status, Boolean(data?.locked));
  }
  if (data === null) throw new ApiError('api.php JSON yanıtı vermedi. Sunucuda PHP etkin mi?', res.status);
  return data as T;
}

type StatePayload = { version: number; files: Record<string, string>; sessions: string[] };

export class RemoteFS implements StateFS {
  private files = new Map<string, string>();
  private sessions = new Set<string>();
  private dirty = new Set<string>();
  private version = 0;
  loaded = false;

  async load() {
    const s = await call<StatePayload>('get_state');
    this.files = new Map(Object.entries(s.files));
    this.sessions = new Set(s.sessions);
    this.dirty.clear();
    this.version = s.version;
    this.loaded = true;
  }

  get hasUnsaved() {
    return this.dirty.size > 0;
  }

  async read(name: string): Promise<string | null> {
    if (this.files.has(name)) return this.files.get(name);
    const m = /^sessions\/(\d{4}-\d{2}-\d{2})\.md$/.exec(name);
    if (!m || !this.sessions.has(`${m[1]}.md`)) return null;
    const { content } = await call<{ content: string }>('get_session', undefined, { date: m[1] });
    this.files.set(name, content);
    return content;
  }

  async write(name: string, content: string) {
    this.files.set(name, content);
    this.dirty.add(name);
    const m = /^sessions\/(.+)$/.exec(name);
    if (m) this.sessions.add(m[1]);
  }

  async list(dir: string) {
    return dir === 'sessions' ? [...this.sessions] : [];
  }

  /** Writes every changed file in one request. Throws ApiError 409 if another device saved first. */
  async flush() {
    if (!this.dirty.size) return;
    const files = Object.fromEntries([...this.dirty].map((n) => [n, this.files.get(n)]));
    const { version } = await call<{ version: number }>('save_state', { version: this.version, files });
    this.version = version;
    this.dirty.clear();
  }
}
