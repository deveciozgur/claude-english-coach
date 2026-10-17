import { NextResponse } from 'next/server';
import { AUTH_COOKIE, SESSION_DAYS, createToken } from '@/lib/auth-token';
import { checkPin, clientIp } from '@/lib/server/auth';


/** Public: checks the master PIN (APP_SECRET_PIN) and sets the signed, HTTP-only lumos_auth cookie. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = checkPin(body?.pin, clientIp(req.headers));
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: result.status, headers: result.retryAfter ? { 'Retry-After': String(result.retryAfter) } : undefined });
  }
  const res = NextResponse.json({ authenticated: true });
  const secure = (req.headers.get('x-forwarded-proto') ?? new URL(req.url).protocol.replace(':', '')) === 'https';
  res.cookies.set(AUTH_COOKIE, await createToken(), { httpOnly: true, sameSite: 'strict', secure, path: '/', maxAge: SESSION_DAYS * 86_400 });
  return res;
}
