/**
 * Accessibility (WCAG 2.1 A/AA via axe-core) on each role's key pages plus the login page.
 * Serious/critical violations fail the test; all violations are annotated for E2E_RESULTS.md.
 */
import AxeBuilder from '@axe-core/playwright';
import { test, expect, task } from '../../lib/fixtures';
import { ROLE_ORDER, PERSONAS } from '../../lib/personas';
import { BASE_URL } from '../../lib/env';

type V = { page: string; id: string; impact: string; help: string; nodes: number; sample: string };
async function scan(page: import('@playwright/test').Page, label: string): Promise<V[]> {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return r.violations.map((v) => ({ page: label, id: v.id, impact: v.impact ?? 'n/a', help: v.help, nodes: v.nodes.length, sample: v.nodes[0]?.target.join(' ') ?? '' }));
}

test(task('anonymous', 'A11Y', 'login page'), async ({ browser }, info) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto(BASE_URL + '/');
  await page.locator('input[name=employeeId]').waitFor();
  const v = await scan(page, '/ (login)');
  info.annotations.push({ type: 'a11y', description: JSON.stringify(v) });
  expect(v.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => `${x.id} (${x.nodes}) ${x.help}`)).toEqual([]);
});

const seen = new Set<string>();
for (const key of ROLE_ORDER) {
  const p = PERSONAS[key];
  const pages = p.allowed.filter((x) => !seen.has(x) && (seen.add(x), true)).slice(0, 6);
  if (!pages.length) continue;
  test(task(p.role, 'A11Y', `axe WCAG 2.1 AA on ${pages.join(' ')}`), async ({ as }, info) => {
    const s = await as(key);
    const all: V[] = [];
    for (const path of pages) {
      await s.goto(path);
      await s.page.locator('h1').first().waitFor({ timeout: 10_000 }).catch(() => {});
      all.push(...(await scan(s.page, path)));
    }
    info.annotations.push({ type: 'a11y', description: JSON.stringify(all) });
    expect(all.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => `${x.page}: ${x.id} ×${x.nodes} — ${x.help}`), 'no serious/critical axe violations').toEqual([]);
  });
}
