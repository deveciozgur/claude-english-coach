import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.APP_SECRET_PIN = 'pin-1234';
process.env.APP_SESSION_SECRET = 'secret';
const { checkPin, clientIp } = await import('./auth.ts');
const token = await import('../auth-token.ts');

test('PIN check: wrong PINs count down, 5 lock the address, right PIN resets', () => {
  assert.equal(checkPin('pin-1234', 'a').ok, true);
  for (let left = 4; left >= 1; left--) assert.match((checkPin('nope', 'b') as { error: string }).error, new RegExp(`${left} attempt`));
  const fifth = checkPin('nope', 'b');
  assert.equal((fifth as { status: number }).status, 429, 'fifth wrong PIN locks');
  assert.equal((checkPin('pin-1234', 'b') as { status: number }).status, 429, 'locked even with the right PIN');
  assert.equal(checkPin('pin-1234', 'c').ok, true, 'other addresses unaffected');
});

test('client address ignores a spoofed first X-Forwarded-For entry', () => {
  assert.equal(clientIp(new Headers({ 'x-forwarded-for': '6.6.6.6, 10.0.0.9' })), '10.0.0.9');
  assert.equal(clientIp(new Headers({ 'x-real-ip': '10.0.0.7', 'x-forwarded-for': '6.6.6.6' })), '10.0.0.7');
  assert.equal(clientIp(new Headers()), 'local');
});

test('session token: valid until expiry, bound to the secret and PIN', async () => {
  const t = await token.createToken();
  assert.equal(await token.verifyToken(t), true);
  assert.equal(await token.verifyToken(t.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'))), false, 'tampered signature');
  assert.equal(await token.verifyToken(`${Date.now() - 1}.${t.split('.')[1]}`), false, 'expired / re-dated');
  assert.equal(await token.verifyToken(await token.createToken(Date.now() - 31 * 86_400_000)), false, 'past 30 days');
  process.env.APP_SECRET_PIN = 'changed';
  assert.equal(await token.verifyToken(t), false, 'changing the PIN signs everyone out');
  process.env.APP_SECRET_PIN = 'pin-1234';
  assert.equal(token.safeEqual('abc', 'abc'), true);
  assert.equal(token.safeEqual('abc', 'abcd'), false);
});
