// Usability walkthrough capture: node tools/walkthrough.mjs <email> <outDir> <path> [path...]
// Screenshots (full page) at 1366x768 and 390x844 + main text dump per screen, for the role-by-role "daily job" review.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const [email, out, ...paths] = process.argv.slice(2);
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5176';
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.E2E_CHROME ?? '/usr/bin/google-chrome' });
for (const [vp, size] of [['1366', { width: 1366, height: 768 }], ['390', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: size, locale: 'en-IN', timezoneId: 'Asia/Kolkata', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE);
  await page.locator('input[name=employeeId]').fill(email);
  await page.locator('input[name=password]').fill(process.env.E2E_PASSWORD ?? 'Rashmi#Test2026');
  await page.locator('input[name=password]').press('Enter');
  await page.locator('input[name=employeeId]').waitFor({ state: 'detached', timeout: 15000 });
  for (const p of paths) {
    await page.goto(BASE + p); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(800);
    const slug = (p.replace(/^\//, '') || 'home').replace(/[^a-z0-9]+/gi, '_');
    await page.screenshot({ path: `${out}/${vp}-${slug}.png`, fullPage: true });
    const txt = await page.locator('main').innerText().catch(() => '');
    fs.writeFileSync(`${out}/${vp}-${slug}.txt`, txt);
    const links = await page.locator('main a, main button').count();
    console.log(vp, p, 'controls', links, 'chars', txt.length, errs.length ? 'ERR ' + errs.join(' | ') : '');
  }
  await ctx.close();
}
await b.close();
