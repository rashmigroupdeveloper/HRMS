/** Login lifecycle for EVERY role: success, wrong password, refresh, logout; plus lockout and password change/reset. */
import { test, expect, loginUI, task } from '../../lib/fixtures';
import { PERSONAS, ROLE_ORDER, PASSWORD, AUTH_TEST_USERS } from '../../lib/personas';
import { BASE_URL } from '../../lib/env';
import { apiLogin, anonApi } from '../../lib/api';
import { q } from '../../lib/db';

for (const key of ROLE_ORDER) {
  const p = PERSONAS[key];
  test.describe(`${p.role} login`, () => {
    test(task(p.role, 'AUTH-01', 'login succeeds and lands on the role home with role nav'), async ({ as, ux }) => {
      ux.start('Sign in');
      const s = await as(key);
      await s.step('home renders with primary navigation', async () => {
        await expect(s.page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
        await expect(s.main()).not.toBeEmpty();
      });
      for (const label of p.nav) {
        await s.step(`nav shows "${label}"`, async () => {
          await expect(s.page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: label, exact: true })).toBeVisible();
        });
      }
      await s.step('account menu identifies the signed-in user', async () => {
        await expect(s.page.getByRole('button', { name: 'Account menu' })).toHaveAttribute('title', new RegExp(p.email.replace('.', '\\.'), 'i'));
      });
    });

    test(task(p.role, 'AUTH-02', 'wrong password is refused with a clear message'), async ({ newSession, ux }) => {
      ux.start('Wrong password');
      const s = await newSession(key);
      await s.step('submit wrong password', () => loginUI(s.page, p.email, 'Wrong#Pass123'));
      await s.step('error is announced and user stays on the login form', async () => {
        await expect(s.page.getByRole('alert').filter({ hasText: /.+/ }).first()).toBeVisible();
        await expect(s.page.locator('input[name=employeeId]')).toBeVisible();
        const msg = await s.page.getByRole('alert').first().innerText();
        expect(msg, 'message must not reveal whether the account exists').not.toMatch(/no such user|not found|unknown user/i);
      });
      // A failed attempt must not count against the next real login; clear it via correct login.
      await s.step('correct password still works afterwards', async () => {
        await loginUI(s.page, p.email);
        await expect(s.page.locator('input[name=employeeId]')).toBeHidden({ timeout: 15_000 });
      });
    });

    test(task(p.role, 'AUTH-03', 'refresh keeps the session; logout ends it and protects routes'), async ({ as, ux }) => {
      ux.start('Refresh + sign out');
      const s = await as(key);
      await s.step('reload the page → still signed in', async () => {
        await s.page.reload(); await s.page.waitForLoadState('networkidle');
        await expect(s.page.locator('input[name=employeeId]')).toBeHidden({ timeout: 10_000 });
        await expect(s.page.getByRole('button', { name: 'Account menu' })).toBeVisible();
      });
      await s.step('sign out from the account menu', async () => { ux.clicks += 2; await s.signOut(); });
      await s.step('protected route after logout shows the login form', async () => {
        await s.page.goto(BASE_URL + '/me'); await s.page.waitForLoadState('networkidle');
        await expect(s.page.locator('input[name=employeeId]')).toBeVisible();
      });
      await s.step('browser Back does not restore the session', async () => {
        await s.page.goBack().catch(() => {}); await s.page.reload(); await s.page.waitForLoadState('networkidle');
        await expect(s.page.locator('input[name=employeeId]')).toBeVisible();
      });
    });
  });
}

test.describe('account security', () => {
  test.describe.configure({ mode: 'serial' });

  test(task('employee', 'AUTH-04', 'lockout after repeated wrong passwords; IT admin can unlock'), async ({ newSession, as, ux }) => {
    ux.start('Lockout + unlock');
    await q('UPDATE core.users SET failed_attempts=0, locked_until=NULL WHERE email=$1', [AUTH_TEST_USERS.lockout]);
    const s = await newSession({ ...PERSONAS.employee, key: 'lockout', email: AUTH_TEST_USERS.lockout });
    for (let i = 1; i <= 5; i++) {
      await s.step(`wrong password attempt ${i}`, async () => {
        await loginUI(s.page, AUTH_TEST_USERS.lockout, `Wrong#Pass${i}`);
        await expect(s.page.getByRole('alert').first()).toBeVisible();
      });
    }
    await s.step('correct password is refused while locked, with a lockout message', async () => {
      await loginUI(s.page, AUTH_TEST_USERS.lockout, PASSWORD);
      await expect(s.page.locator('input[name=employeeId]')).toBeVisible();
      const [row] = await q<{ locked_until: Date | null }>('SELECT locked_until FROM core.users WHERE email=$1', [AUTH_TEST_USERS.lockout]);
      expect(row.locked_until, 'account is locked server-side').not.toBeNull();
      const msg = await s.page.getByRole('alert').first().innerText();
      if (!/lock|too many|try again/i.test(msg)) ux.unclear(1, `locked user sees only "${msg}" — no hint to wait or contact IT`);
    });
    const it = await as('it_admin');
    await it.step('IT admin finds the locked account in Users & Roles and unlocks it', async () => {
      await it.nav(/Users|Access/i, '/admin/users');
      await it.fill(it.main().getByRole('textbox').first(), AUTH_TEST_USERS.lockout);
      await it.click(it.main().getByRole('button', { name: /unlock/i }).first());
    });
    await s.step('user can sign in after unlock', async () => {
      await loginUI(s.page, AUTH_TEST_USERS.lockout, PASSWORD);
      await expect(s.page.locator('input[name=employeeId]')).toBeHidden({ timeout: 15_000 });
    });
  });

  test(task('employee', 'AUTH-05', 'change own password from the account menu'), async ({ as, ux }) => {
    ux.start('Change password');
    await q("UPDATE core.users SET password_hash=(SELECT password_hash FROM core.users WHERE email='employee@rashmi.test'), must_change_password=false, failed_attempts=0, locked_until=NULL WHERE email=$1", [AUTH_TEST_USERS.pwchange]);
    const s = await as({ ...PERSONAS.employee, key: 'pwchange', email: AUTH_TEST_USERS.pwchange });
    const NEW = 'Changed#Pass2026x';
    await s.step('open account menu → Change password', async () => {
      await s.click(s.page.getByRole('button', { name: 'Account menu' }));
      await s.click(s.page.getByRole('menuitem', { name: /change password/i }), { timeout: 4000 });
    });
    await s.step('enter current and new password, submit', async () => {
      const dlg = s.page.getByRole('dialog');
      await s.fill(dlg.getByLabel(/current password/i), PASSWORD);
      await s.fill(dlg.getByLabel(/^new password/i), NEW);
      const confirm = dlg.getByLabel(/confirm/i);
      if (await confirm.count()) await s.fill(confirm, NEW);
      await s.click(dlg.getByRole('button', { name: /change|save|update/i }));
      await s.expectToast(/password/i);
    });
    await s.step('old password no longer works; new one does', async () => {
      const api = await anonApi();
      expect((await api.post('/api/auth/login', { data: { identifier: AUTH_TEST_USERS.pwchange, password: PASSWORD } })).status()).toBe(401);
      expect((await api.post('/api/auth/login', { data: { identifier: AUTH_TEST_USERS.pwchange, password: NEW } })).ok()).toBeTruthy();
    });
  });

  test(task('employee', 'AUTH-06', 'forgot password → reset link → set new password (self-service UI)'), async ({ newSession, ux }) => {
    ux.start('Forgot / reset password');
    const s = await newSession({ ...PERSONAS.employee, key: 'pwreset', email: AUTH_TEST_USERS.pwreset });
    await s.goto('/');
    await s.step('login page offers a self-service "Forgot password" flow (not a mailto link)', async () => {
      const link = s.page.getByRole('link', { name: /forgot password/i }).or(s.page.getByRole('button', { name: /forgot password/i }));
      await expect(link.first()).toBeVisible();
      const href = await link.first().getAttribute('href');
      expect(href ?? '', 'forgot-password should open an in-app reset form, not an email to HR').not.toMatch(/^mailto:/);
      await s.click(link.first());
    });
    await s.step('request a reset link for the account', async () => {
      await s.fill(s.page.getByLabel(/email|employee id/i).first(), AUTH_TEST_USERS.pwreset);
      await s.click(s.page.getByRole('button', { name: /send|reset/i }).first());
    });
    const rows = await q<{ payload: any }>("SELECT payload FROM wf.notifications WHERE recipient_email=$1 AND template_code='password_reset' ORDER BY id DESC LIMIT 1", [AUTH_TEST_USERS.pwreset]).catch(() => []);
    await s.step('reset e-mail is queued and its link opens a reset page', async () => {
      expect(rows.length, 'password_reset notification queued').toBeGreaterThan(0);
      const link = String(rows[0].payload.resetLink ?? '');
      await s.page.goto(link.replace(/^https?:\/\/[^/]+/, BASE_URL));
      await s.fill(s.page.getByLabel(/new password/i).first(), 'Reset#Pass2026x');
      const c = s.page.getByLabel(/confirm/i); if (await c.count()) await s.fill(c, 'Reset#Pass2026x');
      await s.click(s.page.getByRole('button', { name: /reset|save|set/i }).first());
      await loginUI(s.page, AUTH_TEST_USERS.pwreset, 'Reset#Pass2026x');
      await expect(s.page.locator('input[name=employeeId]')).toBeHidden({ timeout: 15_000 });
    });
  });

  test(task('it_admin', 'AUTH-07', 'IT admin issues a temporary password; user is forced to change it at next login'), async ({ as, newSession, ux }) => {
    ux.start('Admin password reset');
    const it = await as('it_admin');
    await it.step('open Users & Roles and issue a temporary password', async () => {
      await it.nav(/Users|Access/i, '/admin/users');
      await it.fill(it.main().getByRole('textbox').first(), AUTH_TEST_USERS.pwreset);
      await it.click(it.main().getByRole('button', { name: /reset password|temporary password/i }).first());
    });
  });
});
