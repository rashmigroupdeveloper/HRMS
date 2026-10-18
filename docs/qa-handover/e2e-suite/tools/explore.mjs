// Dev helper: dump nav + ARIA snapshot per page per role (used to author the suite).
import { chromium } from '@playwright/test';
import fs from 'fs';
const BASE = process.env.E2E_BASE_URL || 'http://localhost:5193';
const [email, ...paths] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('response', r => { if (r.status() >= 400 && r.url().includes('/api/')) errs.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, '')}`); });
await page.goto(BASE);
await page.locator('input[name=employeeId]').fill(email);
await page.locator('input[name=password]').fill('Rashmi#Test2026');
await page.getByRole('button', { name: /sign in/i }).click();
await page.locator('input[name=employeeId]').waitFor({ state: 'detached', timeout: 15000 });
await page.waitForLoadState('networkidle');
const tag = email.split('@')[0];
let out = `# ${email}\n`;
for (const p of paths) {
  if (p !== '-') { await page.goto(BASE + p); }
  await page.waitForLoadState('networkidle'); await page.waitForTimeout(600);
  const snap = (p===paths[0] ? await page.locator('banner, header').first().ariaSnapshot().catch(()=>'') + '\n' : '') + await page.locator('main').ariaSnapshot().catch(e => 'ERR ' + e);
  out += `\n## ${p} -> ${page.url().replace(BASE, '')}\n${snap}\n`;
}
out += `\n## API errors\n${errs.join('\n')}\n`;
fs.writeFileSync(`.explore/${tag}${paths.length===1?paths[0].replace(/\//g,'_'):''}.txt`, out);
console.log(out.length, 'chars', errs.length, 'errors');
await b.close();
