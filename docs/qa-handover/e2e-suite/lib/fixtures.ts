/**
 * Shared fixtures: persona sessions (real UI login), console/network diagnostics,
 * usability scoring (clicks · discoverability · clarity) and repro-step capture.
 * Every test should be titled "[<role>] <TASK-ID> <task>" so the results builder
 * can place it in the role × task matrix.
 */
import { test as base, expect, type Browser, type BrowserContext, type Locator, type Page, type TestInfo } from '@playwright/test';
import { BASE_URL } from './env';
import { PASSWORD, PERSONAS, type Persona } from './personas';

export { expect };

export interface DiagEntry { kind: 'console' | 'pageerror' | 'http' | 'requestfailed'; text: string; who: string; at: string }
export type Discoverability = 'primary' | 'home' | 'in-page' | 'more' | 'palette' | 'url';
const DISC_SCORE: Record<Discoverability, number> = { primary: 5, home: 5, 'in-page': 4, more: 3, palette: 2, url: 1 };

/** Benign noise we never report (refresh probe before login, Vite HMR, React dev warnings). */
const IGNORE = [/\/api\/auth\/refresh/, /Download the React DevTools/, /\[vite\]/, /favicon/];

export class UxTracker {
  clicks = 0; fills = 0; disc: Discoverability | null = null; clarity = 5; notes: string[] = []; task = ''; active = false;
  start(task: string) { this.task = task; this.active = true; }
  discover(d: Discoverability) { if (this.disc === null || DISC_SCORE[d] < DISC_SCORE[this.disc]) this.disc = d; }
  unclear(points: number, why: string) { this.clarity = Math.max(1, this.clarity - points); this.notes.push(why); }
  score() {
    const n = this.clicks + this.fills;
    const clickScore = n <= 4 ? 5 : n <= 7 ? 4 : n <= 10 ? 3 : n <= 15 ? 2 : 1;
    const discScore = DISC_SCORE[this.disc ?? 'primary'];
    const overall = Math.round(((clickScore + discScore + this.clarity) / 3) * 10) / 10;
    return { task: this.task, interactions: n, clicks: this.clicks, fills: this.fills, clickScore, discoverability: this.disc ?? 'primary', discScore, clarity: this.clarity, overall, notes: this.notes };
  }
}

export class Session {
  constructor(public page: Page, public ctx: BrowserContext, public persona: Persona, private ux: UxTracker, private steps: string[]) {}
  get who() { return this.persona.key; }

  async step<T>(desc: string, fn: () => Promise<T>): Promise<T> {
    this.steps.push(`[${this.persona.email}] ${desc}`);
    return base.step(`${this.persona.key}: ${desc}`, fn);
  }
  private say(what: string) { this.steps.push(`[${this.persona.email}]   ${what}`); }
  private static describe(l: Locator) { return String(l).replace(/^locator\('main'\)\./, '').replace(/getByRole\('(\w+)', \{ name: ([^}]+?)(, exact: true)? \}\)/g, '$1 $2').slice(0, 160); }
  async click(l: Locator, opts: { timeout?: number } = {}) { this.ux.clicks++; this.say(`click ${Session.describe(l)}`); await l.click({ timeout: opts.timeout ?? 10_000 }); }
  async fill(l: Locator, v: string) { this.ux.fills++; this.say(`type "${v.slice(0, 60)}" into ${Session.describe(l)}`); await l.fill(v); }
  async select(l: Locator, v: string | { label: string }) { this.ux.fills++; await l.selectOption(v as any); }

  /** Navigate like a user: primary nav → More menu → URL fallback (scored as discoverability). */
  async nav(label: string | RegExp, path: string): Promise<Discoverability> {
    const { page } = this;
    if (!page.url().startsWith(BASE_URL)) await page.goto(BASE_URL + '/');
    const primary = page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: label, exact: typeof label === 'string' });
    let d: Discoverability = 'url';
    if (await primary.first().isVisible().catch(() => false)) {
      await this.click(primary.first()); d = 'primary';
    } else {
      const more = page.getByRole('button', { name: /^More$/ });
      if (await more.isVisible().catch(() => false)) {
        await more.click();
        const item = page.getByRole('menu').getByRole('menuitem', { name: label }).or(page.getByRole('dialog').getByRole('link', { name: label })).or(page.getByRole('menu').getByRole('link', { name: label }));
        if (await item.first().isVisible({ timeout: 1500 }).catch(() => false)) { this.ux.clicks++; await item.first().click(); d = 'more'; }
        else await page.keyboard.press('Escape');
      }
      if (d === 'url') await page.goto(BASE_URL + path);
    }
    this.say(`open ${String(label)} (${d === 'url' ? 'typed URL ' + path : 'via ' + d + ' navigation'})`);
    this.ux.discover(d);
    await page.waitForLoadState('networkidle').catch(() => {});
    return d;
  }
  async goto(path: string) { this.say(`go to ${path}`); await this.page.goto(BASE_URL + path); await this.page.waitForLoadState('networkidle').catch(() => {}); }
  main() { return this.page.locator('main'); }
  toast(re: RegExp | string) { return this.page.locator('[data-sonner-toast]').filter({ hasText: re }); }
  /** Wait for success feedback (sonner toast). Error toasts fail fast with their text; no feedback lowers clarity. */
  async expectToast(re: RegExp | string, timeout = 10_000) {
    const seen = new Set<string>();
    const rx = typeof re === 'string' ? new RegExp(re, 'i') : re;
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const toasts = await this.page.locator('[data-sonner-toast]').evaluateAll((els) => els.map((e) => ({ type: e.getAttribute('data-type') ?? '', text: (e as HTMLElement).innerText.replace(/\s+/g, ' ').trim() }))).catch(() => []);
      for (const t of toasts) {
        seen.add(`${t.type}: ${t.text}`);
        if (t.type !== 'error' && rx.test(t.text)) return t.text;
        if (t.type === 'error') {
          this.ux.unclear(1, `error shown: ${t.text}`);
          throw new Error(`App reported an error instead of success: "${t.text}"`);
        }
      }
      await this.page.waitForTimeout(250);
    }
    this.ux.unclear(2, `expected feedback ${String(re)}; saw: ${[...seen].join(' | ') || 'nothing'}`);
    throw new Error(`No feedback matching ${String(re)}. Toasts seen: ${[...seen].join(' | ') || 'none'}`);
  }
  async errorToastText(): Promise<string> { return (await this.page.locator('[data-sonner-toast][data-type=error]').allInnerTexts().catch(() => [])).join(' | '); }
  async signOut() {
    await this.page.getByRole('button', { name: 'Account menu' }).click();
    await this.page.getByRole('menuitem', { name: /sign out/i }).or(this.page.getByRole('button', { name: /sign out/i })).first().click();
    await expect(this.page.locator('input[name=employeeId]')).toBeVisible({ timeout: 10_000 });
  }
}

export async function loginUI(page: Page, email: string, password = PASSWORD) {
  await page.goto(BASE_URL + '/');
  await page.locator('input[name=employeeId]').fill(email);
  await page.locator('input[name=password]').fill(password);
  // The submit button animates (never "stable" under load); submitting with Enter is what most users do anyway.
  await page.locator('input[name=password]').press('Enter');
}

function attachDiag(page: Page, who: string, sink: DiagEntry[]) {
  const push = (kind: DiagEntry['kind'], text: string) => {
    if (IGNORE.some((r) => r.test(text))) return;
    sink.push({ kind, text: text.slice(0, 400), who, at: page.url().replace(BASE_URL, '') || '/' });
  };
  page.on('console', (m) => { if (m.type() === 'error') push('console', m.text()); });
  page.on('pageerror', (e) => push('pageerror', String(e)));
  page.on('response', (r) => {
    const u = r.url();
    if (u.includes('/api/') && r.status() >= 400) push('http', `${r.status()} ${r.request().method()} ${u.replace(BASE_URL, '')}`);
  });
  page.on('requestfailed', (r) => { if (r.url().includes('/api/')) push('requestfailed', `${r.failure()?.errorText ?? 'failed'} ${r.method()} ${r.url().replace(BASE_URL, '')}`); });
}

interface Fixtures {
  annotate: void;
  ux: UxTracker;
  steps: string[];
  diag: DiagEntry[];
  /** Log in through the real login form as a persona; returns an isolated session. */
  as: (key: keyof typeof PERSONAS | Persona, opts?: { password?: string; expectFail?: boolean }) => Promise<Session>;
  newSession: (key: keyof typeof PERSONAS | Persona) => Promise<Session>;
}

export const test = base.extend<Fixtures>({
  ux: async ({}, use) => { await use(new UxTracker()); },
  steps: async ({}, use) => { await use([]); },
  diag: async ({}, use) => { await use([]); },
  /** Auto: annotate ux/diag/repro on every test (consumed by scripts/build-results.ts). */
  annotate: [async ({ ux, steps, diag }, use, testInfo) => {
    await use();
    if (ux.active) testInfo.annotations.push({ type: 'ux', description: JSON.stringify(ux.score()) });
    if (diag.length) testInfo.annotations.push({ type: 'diag', description: JSON.stringify(diag.slice(0, 40)) });
    if (steps.length) testInfo.annotations.push({ type: 'repro', description: JSON.stringify(steps) });
  }, { auto: true }],
  newSession: async ({ browser, ux, steps, diag }, use) => {
    const ctxs: BrowserContext[] = [];
    await use(async (key) => {
      const persona = typeof key === 'string' ? PERSONAS[key] : key;
      const ctx = await (browser as Browser).newContext();
      ctxs.push(ctx);
      const page = await ctx.newPage();
      attachDiag(page, persona.key, diag);
      return new Session(page, ctx, persona, ux, steps);
    });
    for (const c of ctxs) await c.close().catch(() => {});
  },
  as: async ({ newSession, ux }, use) => {
    await use(async (key, opts = {}) => {
      const s = await newSession(key);
      await s.step(`sign in as ${s.persona.email}`, async () => {
        await loginUI(s.page, s.persona.email, opts.password);
        if (!opts.expectFail) {
          await expect(s.page.locator('input[name=employeeId]')).toBeHidden({ timeout: 15_000 });
          await s.page.waitForLoadState('networkidle').catch(() => {});
        }
      });
      ux.clicks = 0; ux.fills = 0; // login is not part of any task
      return s;
    });
  },
});

/** Parse "[role] ID title" titles. */
export function task(role: string, id: string, title: string) { return `[${role}] ${id} ${title}`; }
