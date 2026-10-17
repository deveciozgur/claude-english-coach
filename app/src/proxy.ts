// Gatekeeper for every page and API route (Next.js proxy, Node.js runtime).
// Without a valid `lumos_auth` cookie, pages redirect to /unlock and API calls get 401.

import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE, pinConfigured, verifyToken } from '@/lib/auth-token';

const PUBLIC = ['/unlock', '/api/auth/status', '/api/auth/verify', '/api/auth/logout'];

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');

  if (!pinConfigured()) {
    // Local development may run unlocked; a production server never does.
    if (process.env.NODE_ENV !== 'production') return NextResponse.next();
    const msg = 'APP_SECRET_PIN is not set. Add it to .env next to server.js and restart.';
    return isApi ? NextResponse.json({ error: msg }, { status: 503 }) : new NextResponse(msg, { status: 503 });
  }

  const authed = await verifyToken(req.cookies.get(AUTH_COOKIE)?.value);
  if (PUBLIC.includes(pathname)) {
    return pathname === '/unlock' && authed ? NextResponse.redirect(new URL('/', req.url)) : NextResponse.next();
  }
  if (authed) return NextResponse.next();
  if (isApi) return NextResponse.json({ error: 'Locked', locked: true }, { status: 401 });

  const url = new URL('/unlock', req.url);
  if (pathname !== '/') url.searchParams.set('next', pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
