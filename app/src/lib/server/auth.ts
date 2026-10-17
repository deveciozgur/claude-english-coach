// Master PIN check and brute-force brake for /api/auth/verify. The cookie itself is signed and
// verified in ../auth-token.ts, which the proxy also uses.

import 'server-only';
import { safeEqual } from '../auth-token.ts';

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
// Backstop against spoofed addresses: this many wrong PINs in total within the window locks everyone.
const GLOBAL_MAX_FAILS = 30;
let globalFails: number[] = [];

type Attempt = { fails: number; until: number };
const attempts = new Map<string, Attempt>();

export type PinResult = { ok: true } | { ok: false; status: 401 | 429 | 503; error: string; retryAfter?: number };

/** Checks a PIN against APP_SECRET_PIN. Five wrong PINs from one address lock it for 15 minutes. */
export function checkPin(pin: unknown, ip: string): PinResult {
  const secret = process.env.APP_SECRET_PIN;
  if (!secret) return { ok: false, status: 503, error: 'APP_SECRET_PIN is not set on the server.' };

  const now = Date.now();
  globalFails = globalFails.filter((t) => t > now - LOCK_MINUTES * 60_000);
  if (globalFails.length >= GLOBAL_MAX_FAILS) {
    const retryAfter = Math.ceil((globalFails[0] + LOCK_MINUTES * 60_000 - now) / 1000);
    return { ok: false, status: 429, error: `Too many attempts. Try again in ${Math.ceil(retryAfter / 60)} min.`, retryAfter };
  }
  const a = attempts.get(ip);
  if (a?.until && a.until > now) {
    const retryAfter = Math.ceil((a.until - now) / 1000);
    return { ok: false, status: 429, error: `Too many attempts. Try again in ${Math.ceil(retryAfter / 60)} min.`, retryAfter };
  }
  if (a?.until) attempts.delete(ip);

  if (typeof pin === 'string' && pin && safeEqual(pin, secret)) {
    attempts.delete(ip);
    return { ok: true };
  }
  globalFails.push(now);
  const next = { fails: (attempts.get(ip)?.fails ?? 0) + 1, until: 0 };
  if (next.fails >= MAX_FAILS) next.until = now + LOCK_MINUTES * 60_000;
  attempts.set(ip, next);
  const left = MAX_FAILS - next.fails;
  return left > 0
    ? { ok: false, status: 401, error: `Wrong PIN. ${left} attempt${left > 1 ? 's' : ''} left.` }
    : { ok: false, status: 429, error: `Too many attempts. Try again in ${LOCK_MINUTES} min.`, retryAfter: LOCK_MINUTES * 60 };
}

/**
 * Client address for rate limiting. Behind Nginx, X-Real-IP is set from $remote_addr and the last
 * X-Forwarded-For entry is the one Nginx appended; the first entry is whatever the client sent.
 */
export function clientIp(headers: Headers): string {
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real;
  const chain = (headers.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return chain.at(-1) ?? 'local';
}
