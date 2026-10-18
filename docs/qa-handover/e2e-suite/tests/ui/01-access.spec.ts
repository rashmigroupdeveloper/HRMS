/** Per-role page access through the UI: allowed pages render real content; forbidden pages are denied (negative permission tests). */
import { test, expect, task } from '../../lib/fixtures';
import { PERSONAS, ROLE_ORDER } from '../../lib/personas';

const DENIED = /missing permission|not allowed|access denied|don.t have (access|permission)|forbidden|not authori[sz]ed|no access/i;

for (const key of ROLE_ORDER) {
  const p = PERSONAS[key];
  test(task(p.role, 'NAV-01', 'every page the role needs opens without errors'), async ({ as, diag }) => {
    const s = await as(key);
    const problems: string[] = [];
    for (const path of p.allowed) {
      await s.step(`open ${path}`, async () => {
        const before = diag.length;
        await s.goto(path);
        await s.page.waitForTimeout(400);
        const url = new URL(s.page.url());
        if (url.pathname !== path.split('?')[0]) problems.push(`${path}: redirected to ${url.pathname}`);
        const alerts = (await s.main().getByRole('alert').allInnerTexts()).join(' | ');
        if (DENIED.test(alerts)) problems.push(`${path}: shows "${alerts.slice(0, 160)}"`);
        if (!(await s.main().getByRole('heading', { level: 1 }).count())) problems.push(`${path}: no page heading`);
        const errs = diag.slice(before).filter((d) => d.kind === 'pageerror' || /^5\d\d /.test(d.text) || (d.kind === 'http' && /^403 /.test(d.text)));
        for (const e of errs) problems.push(`${path}: ${e.kind} ${e.text}`);
      });
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  if (p.forbidden.length) {
    test(task(p.role, 'NEG-UI', 'pages outside the role are denied (no data, no actions)'), async ({ as }) => {
      const s = await as(key);
      const problems: string[] = [];
      for (const path of p.forbidden) {
        await s.step(`try ${path} (must be denied)`, async () => {
          await s.goto(path);
          await s.page.waitForTimeout(500);
          const url = new URL(s.page.url());
          const redirected = url.pathname !== path.split('?')[0];
          const text = await s.main().innerText().catch(() => '');
          const denied = DENIED.test(text);
          if (!redirected && !denied) problems.push(`${path}: page rendered for ${p.role} with no denial (title: "${(await s.main().getByRole('heading', { level: 1 }).first().innerText().catch(() => '?'))}")`);
          // Even on a denied page, mutating controls must not be offered.
          const actions = s.main().getByRole('button', { name: /^(new run|compute|rebuild snapshot|grant|save|lock|approve|issue|create)/i });
          const n = await actions.count();
          if (!redirected && n) problems.push(`${path}: ${n} action button(s) offered to ${p.role}: ${(await actions.allInnerTexts()).slice(0, 4).join(', ')}`);
        });
      }
      expect(problems, problems.join('\n')).toEqual([]);
    });
  }
}
