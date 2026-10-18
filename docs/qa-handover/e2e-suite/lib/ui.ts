/** Small UI helpers for this app's custom widgets (Select listbox, DatePicker, Drawer, approvals inbox). */
import { expect, type Locator } from '@playwright/test';
import type { Session } from './fixtures';

/** Custom <Select>: click the combobox, then the option. Falls back to native <select>. */
export async function choose(s: Session, combo: Locator, option: string | RegExp) {
  const tag = await combo.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
  if (tag === 'select') { await s.select(combo, typeof option === 'string' ? { label: option } : { label: String(option) }); return; }
  await s.click(combo);
  const opt = s.page.getByRole('option', { name: option }).first();
  await expect(opt).toBeVisible({ timeout: 5000 });
  await opt.click();
}

/** DatePicker trigger button → calendar day button named like "28 Oct 2026". */
export async function pickDate(s: Session, trigger: Locator, dayLabel: string) {
  await s.click(trigger);
  // Day cells are labelled "02 Nov 2026" (2-digit day) or "2 Nov 2026" depending on the formatter: accept both.
  const m = /^0?(\d{1,2}) (.+)$/.exec(dayLabel);
  const name = m ? new RegExp(`^0?${m[1]} ${m[2].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) : dayLabel;
  const day = s.page.getByRole('button', { name, exact: typeof name === 'string' }).last();
  // Walk the calendar towards the target month (past dates go back, future dates go forward).
  const target = new Date(`${dayLabel} UTC`);
  const back = !Number.isNaN(target.getTime()) && target.getTime() < Date.now() - 86_400_000;
  for (let i = 0; i < 12 && !(await day.isVisible().catch(() => false)); i++) {
    await s.page.getByRole('button', { name: back ? /previous month|prev(ious)? month/i : /next month/i }).last().click();
  }
  await s.click(day);
}

/** Approvals inbox: open the queue item matching `match`, decide, and wait for it to leave the queue. */
export async function decide(s: Session, match: RegExp, action: 'Approve' | 'Reject' | 'Send back', note?: string) {
  await s.nav('Approvals', '/approvals');
  if (!s.page.url().includes('/approvals')) {
    // Approvals sits in the masthead as a badge button for ops roles.
    const badge = s.page.getByRole('button', { name: /^Approvals/ });
    if (await badge.isVisible().catch(() => false)) await s.click(badge); else await s.goto('/approvals');
  }
  const item = s.main().getByRole('button', { name: match }).first();
  await expect(item, `approval request ${match} visible in ${s.persona.email}'s inbox`).toBeVisible({ timeout: 15_000 });
  await s.click(item);
  if (note) await s.fill(s.main().getByRole('textbox', { name: /decision note/i }), note);
  await s.click(s.main().getByRole('button', { name: new RegExp(`^${action}$`) }).first());
  const confirm = s.page.getByRole('dialog').getByRole('button', { name: new RegExp(`^(${action}|confirm)`, 'i') });
  if (await confirm.isVisible({ timeout: 1500 }).catch(() => false)) await s.click(confirm);
}
