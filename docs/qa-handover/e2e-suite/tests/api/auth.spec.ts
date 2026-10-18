/** Auth API checks: refresh rotation, logout revocation, lockout, change/forgot/reset password, IT unlock. */
import { test, expect } from '@playwright/test';
import { anonApi, apiLogin } from '../../lib/api';
import { PASSWORD } from '../../lib/personas';
import { q } from '../../lib/db';

test.describe.configure({ mode: 'serial' });
const resetUser = async (email: string) => q("UPDATE core.users SET password_hash=(SELECT password_hash FROM core.users WHERE email='employee@rashmi.test'), failed_attempts=0, locked_until=NULL, must_change_password=false WHERE email=$1", [email]);

test('[employee] API-AUTH-01 login returns access token + httpOnly refresh cookie; /auth/me works', async () => {
  const api = await anonApi();
  const res = await api.post('/api/auth/login', { data: { identifier: 'employee@rashmi.test', password: PASSWORD } });
  expect(res.status()).toBe(200);
  const setCookie = res.headers()['set-cookie'] ?? '';
  expect(setCookie).toMatch(/httponly/i);
  const { accessToken } = await res.json();
  const me = await api.get('/api/auth/me', { headers: { authorization: `Bearer ${accessToken}` } });
  expect(me.status()).toBe(200);
  expect(JSON.stringify(await me.json())).toContain('employee@rashmi.test');
});

test('[employee] API-AUTH-02 refresh rotates; logout revokes the refresh token', async () => {
  const api = await anonApi();
  await api.post('/api/auth/login', { data: { identifier: 'employee@rashmi.test', password: PASSWORD } });
  const r1 = await api.post('/api/auth/refresh');
  expect(r1.status()).toBe(200);
  const tok = (await r1.json()).accessToken;
  expect((await api.post('/api/auth/logout', { headers: { authorization: `Bearer ${tok}` } })).status()).toBe(200);
  expect((await api.post('/api/auth/refresh')).status()).toBe(401);
});

test('[employee] API-AUTH-03 unauthenticated calls are 401, never data', async () => {
  const api = await anonApi();
  for (const p of ['/api/auth/me', '/api/employees', '/api/leave/balances']) expect((await api.get(p)).status(), p).toBe(401);
  expect((await api.post('/api/payroll/runs/list', { data: {} })).status()).toBe(401);
});

test('[employee] API-AUTH-04 lockout after 5 failures; IT admin unlock restores login', async () => {
  await resetUser('apilock@rashmi.test');
  const api = await anonApi();
  for (let i = 0; i < 5; i++) expect((await api.post('/api/auth/login', { data: { identifier: 'apilock@rashmi.test', password: 'Bad#' + i } })).status()).toBe(401);
  const locked = await api.post('/api/auth/login', { data: { identifier: 'apilock@rashmi.test', password: PASSWORD } });
  expect(locked.status(), 'correct password refused while locked').toBeGreaterThanOrEqual(400);
  const it = await apiLogin('itadmin@rashmi.test');
  const [{ id }] = await q<{ id: number }>("SELECT id FROM core.users WHERE email='apilock@rashmi.test'");
  expect((await it.post(`/api/auth/users/${id}/unlock`)).status()).toBe(200);
  expect((await api.post('/api/auth/login', { data: { identifier: 'apilock@rashmi.test', password: PASSWORD } })).status()).toBe(200);
});

test('[employee] API-AUTH-05 change password: policy enforced, old password stops working, other sessions signed out', async () => {
  await resetUser('apipw@rashmi.test');
  const a = await apiLogin('apipw@rashmi.test');
  const other = await anonApi();
  await other.post('/api/auth/login', { data: { identifier: 'apipw@rashmi.test', password: PASSWORD } });
  const weak = await a.post('/api/auth/change-password', { currentPassword: PASSWORD, newPassword: 'short' });
  expect(weak.status(), 'weak password rejected').toBe(400);
  const wrongCur = await a.post('/api/auth/change-password', { currentPassword: 'nope', newPassword: 'Strong#Pass2026x' });
  expect(wrongCur.status(), 'wrong current password rejected').toBeGreaterThanOrEqual(400);
  expect((await a.post('/api/auth/change-password', { currentPassword: PASSWORD, newPassword: 'Strong#Pass2026x' })).status()).toBe(200);
  const api = await anonApi();
  expect((await api.post('/api/auth/login', { data: { identifier: 'apipw@rashmi.test', password: PASSWORD } })).status()).toBe(401);
  expect((await api.post('/api/auth/login', { data: { identifier: 'apipw@rashmi.test', password: 'Strong#Pass2026x' } })).status()).toBe(200);
  expect((await other.post('/api/auth/refresh')).status(), 'other session revoked').toBe(401);
});

test('[employee] API-AUTH-06 forgot password → single-use reset token; unknown account gets same answer', async () => {
  await resetUser('apipw@rashmi.test');
  const api = await anonApi();
  const unknown = await api.post('/api/auth/forgot-password', { data: { identifier: 'nobody-here@rashmi.test' } });
  const known = await api.post('/api/auth/forgot-password', { data: { identifier: 'apipw@rashmi.test' } });
  expect(unknown.status()).toBe(known.status());
  expect(known.status()).toBe(200);
  const [row] = await q<{ payload: any }>("SELECT payload FROM wf.notifications WHERE recipient_email='apipw@rashmi.test' AND template_code='password_reset' ORDER BY id DESC LIMIT 1");
  expect(row, 'reset e-mail queued').toBeTruthy();
  const token = new URL(String(row.payload.resetLink)).searchParams.get('token')!;
  expect((await api.post('/api/auth/reset-password', { data: { token, newPassword: 'Reset#Pass2026y' } })).status()).toBe(200);
  expect((await api.post('/api/auth/reset-password', { data: { token, newPassword: 'Reset#Pass2026z' } })).status(), 'token is single-use').toBeGreaterThanOrEqual(400);
  expect((await api.post('/api/auth/login', { data: { identifier: 'apipw@rashmi.test', password: 'Reset#Pass2026y' } })).status()).toBe(200);
  await resetUser('apipw@rashmi.test');
});

test('[it_admin] API-AUTH-07 temporary password forces change at next login', async () => {
  await resetUser('apipw@rashmi.test');
  const it = await apiLogin('itadmin@rashmi.test');
  const [{ id }] = await q<{ id: number }>("SELECT id FROM core.users WHERE email='apipw@rashmi.test'");
  const res = await it.post(`/api/auth/users/${id}/reset-password`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  const temp = body.temporaryPassword ?? body.password ?? body.tempPassword;
  expect(temp, `temporary password returned once: ${JSON.stringify(Object.keys(body))}`).toBeTruthy();
  const api = await anonApi();
  const login = await api.post('/api/auth/login', { data: { identifier: 'apipw@rashmi.test', password: temp } });
  expect(login.status()).toBe(200);
  const { accessToken } = await login.json();
  const me = await (await api.get('/api/auth/me', { headers: { authorization: `Bearer ${accessToken}` } })).json();
  expect(JSON.stringify(me), 'session must flag a forced password change').toMatch(/must_?change_?password"?:\s*true/i);
  await resetUser('apipw@rashmi.test');
});
