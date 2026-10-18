/**
 * Responsive health: every role's key pages at desktop / tablet / mobile (project decides the device).
 * Fails on uncaught page errors, console errors, 5xx / failed requests, and horizontal overflow (tablet/mobile).
 */
import { test, expect, task } from '../../lib/fixtures';
import { ROLE_ORDER, PERSONAS } from '../../lib/personas';

for (const key of ROLE_ORDER) {
  const p = PERSONAS[key];
  test(task(p.role, 'VP', `key pages render cleanly on this viewport (${p.allowed.slice(0, 6).join(' ')})`), async ({ as, diag }, info) => {
    const device = info.project.name.replace('viewport-', '');
    const s = await as(key);
    const overflow: string[] = [];
    for (const path of p.allowed.slice(0, 6)) {
      await test.step(`${device}: ${path}`, async () => {
        await s.goto(path);
        await expect(s.page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
        if (device !== 'desktop') {
          const o = await s.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
          if (o.sw > o.w + 2) overflow.push(`${path}: page is ${o.sw}px wide on a ${o.w}px screen`);
        }
      });
    }
    // Mobile navigation must be reachable (menu button or bottom nav).
    if (device === 'mobile') {
      await s.goto('/');
      const menu = s.page.getByRole('button', { name: /menu|navigation|more/i }).or(s.page.getByRole('navigation').getByRole('link'));
      await expect(menu.first(), 'mobile: a navigation control is reachable').toBeVisible();
    }
    // Browser 'Failed to load resource' lines duplicate the http entries (which carry the URL), so use those instead.
    // 401/403 are permission outcomes covered by the access specs; 404 and 5xx are defects.
    const errs = diag.filter((d) => d.kind === 'pageerror' || (d.kind === 'requestfailed' && !/ERR_ABORTED/.test(d.text))
      || (d.kind === 'console' && !/Failed to load resource/.test(d.text))
      || (d.kind === 'http' && /^(404|5\d\d) /.test(d.text)));
    expect.soft(overflow, 'no horizontal scrolling').toEqual([]);
    expect(errs.map((e) => `${e.kind}: ${e.text}`), 'no console errors, page errors or failed/5xx calls').toEqual([]);
  });
}
