// Dev helper: open a page, click a sequence of buttons (by accessible name regex), dump the resulting dialog/main ARIA.
import { chromium } from '@playwright/test';
const BASE = 'http://localhost:5193';
const [email, path, ...clicks] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(BASE);
await page.locator('input[name=employeeId]').fill(email);
await page.locator('input[name=password]').fill('Rashmi#Test2026');
await page.locator('input[name=password]').press('Enter');
await page.locator('input[name=employeeId]').waitFor({ state: 'detached', timeout: 15000 });
await page.goto(BASE + path); await page.waitForLoadState('networkidle');
for (const c of clicks) {
  const [kind, name] = c.includes(':') ? c.split(/:(.*)/s) : ['button', c];
  await page.getByRole(kind, { name: new RegExp(name, 'i') }).first().click();
  await page.waitForTimeout(700);
}
const dlg = page.getByRole('dialog');
const target = (await dlg.count()) ? dlg.last() : page.locator('main');
console.log(await target.ariaSnapshot());
await b.close();
