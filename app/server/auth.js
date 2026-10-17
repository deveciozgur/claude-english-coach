// Gatekeeper: one master PIN (APP_SECRET_PIN in .env) protects the coach panel and every API route.
// A correct PIN sets an HttpOnly, signed session cookie; nothing secret is stored in the browser.

import crypto from 'node:crypto';
import { IS_RELEASE } from './env.js';

const PIN = process.env.APP_SECRET_PIN ?? '';
// Changing the PIN or APP_SESSION_SECRET signs everyone out. Without APP_SESSION_SECRET, sessions last until a restart.
const SECRET = `${process.env.APP_SESSION_SECRET || crypto.randomBytes(32).toString('hex')}:${PIN}`;
const COOKIE = 'apex_session';
const SESSION_DAYS = 30;
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

export const authRequired = () => Boolean(PIN);

/** Refuses to run a public (release) server without a PIN. */
export function assertAuthConfigured() {
  if (IS_RELEASE && !PIN) {
    console.error('APP_SECRET_PIN is not set. Add it to app/.env (see .env.example) before starting the server.');
    process.exit(1);
  }
  if (!PIN) console.warn('APP_SECRET_PIN is not set: the gatekeeper is off (local development only).');
}

const sign = (value) => crypto.createHmac('sha256', SECRET).update(value).digest('base64url');
const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));

function readCookie(req) {
  const pair = (req.headers.cookie ?? '').split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  return pair ? decodeURIComponent(pair.slice(COOKIE.length + 1)) : '';
}

function isAuthenticated(req) {
  if (!PIN) return true;
  const [exp, sig] = readCookie(req).split('.');
  return Boolean(exp && sig) && Number(exp) > Date.now() && safeEqual(sig, sign(exp));
}

function setCookie(req, res, value, maxAgeSeconds) {
  const parts = [`${COOKIE}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSeconds}`];
  if (req.secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

// Brute-force brake: MAX_FAILS wrong PINs from one address lock it out for LOCK_MINUTES.
const attempts = new Map();
function lockedFor(ip) {
  const a = attempts.get(ip);
  if (!a?.until) return 0;
  if (a.until <= Date.now()) {
    attempts.delete(ip);
    return 0;
  }
  return Math.ceil((a.until - Date.now()) / 1000);
}
function recordFail(ip) {
  const a = attempts.get(ip) ?? { fails: 0, until: 0 };
  a.fails += 1;
  if (a.fails >= MAX_FAILS) a.until = Date.now() + LOCK_MINUTES * 60_000;
  attempts.set(ip, a);
  return MAX_FAILS - a.fails;
}

/** Mounts /api/auth/* (public) and protects every other /api route. */
export function mountAuth(app) {
  app.get('/api/auth/status', (req, res) => res.json({ required: authRequired(), authenticated: isAuthenticated(req) }));

  app.post('/api/auth/login', (req, res) => {
    if (!PIN) return res.json({ authenticated: true });
    const wait = lockedFor(req.ip);
    if (wait) return res.status(429).json({ error: `Too many attempts. Try again in ${Math.ceil(wait / 60)} min.`, retryAfter: wait });
    const pin = typeof req.body?.pin === 'string' ? req.body.pin : '';
    if (!pin || !safeEqual(pin, PIN)) {
      const left = recordFail(req.ip);
      return res.status(401).json({ error: left > 0 ? `Wrong PIN. ${left} attempt${left > 1 ? 's' : ''} left.` : `Too many attempts. Try again in ${LOCK_MINUTES} min.` });
    }
    attempts.delete(req.ip);
    const exp = String(Date.now() + SESSION_DAYS * 86_400_000);
    setCookie(req, res, `${exp}.${sign(exp)}`, SESSION_DAYS * 86_400);
    res.json({ authenticated: true });
  });

  app.post('/api/auth/logout', (req, res) => {
    setCookie(req, res, '', 0);
    res.json({ authenticated: false });
  });

  app.use('/api', (req, res, next) => (isAuthenticated(req) ? next() : res.status(401).json({ error: 'Locked', locked: true })));
}
