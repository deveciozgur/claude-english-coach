import { cookies } from 'next/headers';
import { AUTH_COOKIE, pinConfigured, verifyToken } from '@/lib/auth-token';


/** Public: tells the lock screen whether a PIN is required and whether this browser is signed in. */
export async function GET() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  const required = pinConfigured() || process.env.NODE_ENV === 'production';
  return Response.json({ required, authenticated: required ? await verifyToken(token) : true });
}
