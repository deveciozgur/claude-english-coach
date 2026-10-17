// Signed session token for the `lumos_auth` cookie. Web Crypto only, so the same code runs in the
// proxy (middleware) and in route handlers. Format: `<expiry ms>.<HMAC-SHA256(expiry), base64url>`.
// The key mixes APP_SESSION_SECRET with APP_SECRET_PIN: changing either signs everyone out.

export const AUTH_COOKIE = 'lumos_auth';
export const SESSION_DAYS = 30;

const enc = new TextEncoder();

export const pinConfigured = (): boolean => Boolean(process.env.APP_SECRET_PIN);

async function hmac(value: string): Promise<string> {
  const secret = `${process.env.APP_SESSION_SECRET ?? ''}:lumos:${process.env.APP_SECRET_PIN ?? ''}`;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
  let bin = '';
  for (const b of sig) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Constant-time comparison of two strings of possibly different length. */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function createToken(now = Date.now()): Promise<string> {
  const exp = String(now + SESSION_DAYS * 86_400_000);
  return `${exp}.${await hmac(exp)}`;
}

export async function verifyToken(token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!pinConfigured()) return false;
  const [exp, sig] = (token ?? '').split('.');
  if (!exp || !sig || !(Number(exp) > now)) return false;
  return safeEqual(sig, await hmac(exp));
}
