import { NextResponse } from 'next/server';
import { AUTH_COOKIE } from '@/lib/auth-token';


export async function POST() {
  const res = NextResponse.json({ authenticated: false });
  res.cookies.set(AUTH_COOKIE, '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 });
  return res;
}
