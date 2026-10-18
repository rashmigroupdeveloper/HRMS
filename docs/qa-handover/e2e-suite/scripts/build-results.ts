/**
 * Turn reports/results.json (Playwright JSON reporter) into
 *   $E2E_OUT/E2E_RESULTS.md  — matrix per role per task, failures (screenshot/trace/repro), usability, a11y, console/network
 *   $E2E_OUT/FAILURES.md     — actionable list for the fixer, grouped by area
 * and copy failure screenshots + traces to $E2E_OUT/artifacts/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { hintFor } from '../lib/hints';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = process.env.E2E_OUT ?? '/workspace/hrms-test/e2e';
const RES = path.join(ROOT, 'reports/results.json');
const ART = path.join(OUT, 'artifacts');
fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(ART, { recursive: true, force: true });
fs.mkdirSync(ART, { recursive: true });

type Ann = { type: string; description?: string };
type Row = {
  role: string; id: string; title: string; full: string; file: string; project: string; status: string; duration: number;
  error: string; ux?: any; diag: any[]; repro: string[]; a11y: any[]; shots: string[]; trace?: string; steps: string[];
};
const json = JSON.parse(fs.readFileSync(RES, 'utf8'));
const rows: Row[] = [];
const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');
function stepTitles(steps: any[] | undefined, depth = 0, out: string[] = []) {
  for (const st of steps ?? []) { if (depth < 2 && st.title && !/^(Before|After) Hooks|^fixture|^attach/.test(st.title)) out.push(`${'  '.repeat(depth)}${st.title}${st.error ? '  ✗' : ''}`); stepTitles(st.steps, depth + 1, out); }
  return out;
}
function walk(suite: any, file = '') {
  const f = suite.file ?? file;
  for (const s of suite.suites ?? []) walk(s, f);
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      const res = t.results?.[t.results.length - 1] ?? {};
      const anns: Ann[] = [...(t.annotations ?? []), ...(res.annotations ?? [])];
      const get = (k: string) => anns.filter((a) => a.type === k).map((a) => { try { return JSON.parse(a.description ?? 'null'); } catch { return a.description; } });
      const m = /^\[([^\]]+)\]\s+(\S+)\s+(.*)$/.exec(spec.title) ?? [null, 'other', '-', spec.title];
      const status = res.status === 'passed' ? 'pass' : res.status === 'skipped' || t.status === 'skipped' ? 'skip' : res.status === 'timedOut' ? 'fail' : res.status === 'failed' ? 'fail' : res.status ?? 'skip';
      rows.push({
        role: m[1]!, id: m[2]!, title: m[3]!, full: spec.title, file: f, project: t.projectName, status, duration: res.duration ?? 0,
        error: strip(res.error?.message ?? (res.errors ?? []).map((e: any) => e.message).join('\n') ?? ''),
        ux: get('ux')[0], diag: get('diag').flat(), repro: get('repro').flat(), a11y: get('a11y').flat(),
        shots: (res.attachments ?? []).filter((a: any) => a.contentType === 'image/png' && a.path).map((a: any) => a.path),
        trace: (res.attachments ?? []).find((a: any) => a.name === 'trace' && a.path)?.path,
        steps: stepTitles(res.steps),
      });
    }
  }
}
for (const s of json.suites ?? []) walk(s);

const ROLE_ORDER = ['employee', 'manager', 'senior_manager', 'hod', 'hr_ops (RML)', 'hr_ops (RGH)', 'hr_ops_rml', 'hr_ops_rgh', 'hr_head', 'payroll_admin', 'plant_head', 'ceo_cell', 'it_admin', 'super_admin', 'anonymous'];
const roles = [...new Set(rows.map((r) => r.role))].sort((a, b) => (ROLE_ORDER.indexOf(a) + 100 * +(ROLE_ORDER.indexOf(a) < 0)) - (ROLE_ORDER.indexOf(b) + 100 * +(ROLE_ORDER.indexOf(b) < 0)) || a.localeCompare(b));
const icon = (s: string) => (s === 'pass' ? '✅' : s === 'fail' ? '❌' : '⏭️');
const esc = (s: string) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const firstLines = (e: string, n = 4) => e.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim() && !/^\s+at |^\s+\d+ \||^\s+>? ?\d+ \||^\s+\|/.test(l)).slice(0, n).join('\n');
const area = (r: Row) => {
  const f = r.file;
  if (r.project === 'a11y') return 'Accessibility (axe)';
  if (r.project.startsWith('viewport')) return 'Responsive / console / network';
  if (/api\//.test(f)) return 'API';
  if (/00-auth/.test(f)) return 'Authentication';
  if (/01-access/.test(f)) return r.id === 'NEG-UI' ? 'RBAC — negative (UI)' : 'Navigation / page health';
  if (/40-payroll/.test(f)) return 'Payroll run & configuration';
  if (/20-approval/.test(f)) return 'Approval chains';
  if (/50-role-tasks/.test(f)) return 'ROLE_TASKS coverage (entry points)';
  return 'Role task flows';
};

let fixHead = process.env.E2E_FIX_HEAD ?? '';
try { fixHead ||= execSync('git -C /workspace/hrms-fix log -1 --format="%h %s (%ci)"').toString().trim(); } catch {}
let dirty = '';
try { dirty = execSync('git -C /workspace/hrms-fix status --porcelain').toString().trim() ? ' + uncommitted working-tree changes' : ''; } catch {}
const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST';
const tot = { all: rows.length, pass: rows.filter((r) => r.status === 'pass').length, fail: rows.filter((r) => r.status === 'fail').length, skip: rows.filter((r) => r.status === 'skip').length };

// Copy failure artifacts
const fails = rows.filter((r) => r.status === 'fail');
fails.forEach((r, i) => {
  const slug = `${String(i + 1).padStart(3, '0')}-${(r.role + '-' + r.id + '-' + r.project).replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 60)}`;
  const dir = path.join(ART, slug);
  const copied: string[] = [];
  for (const p of r.shots) if (fs.existsSync(p)) { fs.mkdirSync(dir, { recursive: true }); const d = path.join(dir, path.basename(p)); fs.copyFileSync(p, d); copied.push(d); }
  r.shots = copied;
  if (r.trace && fs.existsSync(r.trace)) { fs.mkdirSync(dir, { recursive: true }); const d = path.join(dir, 'trace.zip'); fs.copyFileSync(r.trace, d); r.trace = d; }
});

const L: string[] = [];
L.push('# Rashmi HRMS — end-to-end UI results', '');
L.push(`- **Run:** ${now}`, `- **Build under test:** /workspace/hrms-fix @ ${fixHead}${dirty}`, `- **App:** ${process.env.E2E_BASE_URL ?? 'http://localhost:5193'} (backend :5130, DB hrms_e2e restored from the tester snapshot + migrations + seeds)`);
L.push(`- **Totals:** ${tot.all} tests — ✅ ${tot.pass} passed · ❌ ${tot.fail} failed · ⏭️ ${tot.skip} skipped`);
L.push('- **HTML report:** /workspace/hrms-e2e/reports/html/index.html (`npm run show-report`) · **Fixer list:** FAILURES.md', '');
L.push('## Pass/fail per role', '', '| Role | Tests | ✅ Pass | ❌ Fail | ⏭️ Skip | Avg usability |', '|---|---:|---:|---:|---:|---:|');
for (const role of roles) {
  const rr = rows.filter((r) => r.role === role);
  const ux = rr.filter((r) => r.ux?.overall).map((r) => r.ux.overall);
  L.push(`| ${role} | ${rr.length} | ${rr.filter((r) => r.status === 'pass').length} | ${rr.filter((r) => r.status === 'fail').length} | ${rr.filter((r) => r.status === 'skip').length} | ${ux.length ? (ux.reduce((a: number, b: number) => a + b, 0) / ux.length).toFixed(1) : '–'} |`);
}
L.push('', '## Pass/fail per area', '', '| Area | Tests | ✅ | ❌ | ⏭️ |', '|---|---:|---:|---:|---:|');
for (const a of [...new Set(rows.map(area))]) { const rr = rows.filter((r) => area(r) === a); L.push(`| ${a} | ${rr.length} | ${rr.filter((r) => r.status === 'pass').length} | ${rr.filter((r) => r.status === 'fail').length} | ${rr.filter((r) => r.status === 'skip').length} |`); }

L.push('', '## Matrix — every role × task', '');
for (const role of roles) {
  L.push(`### ${role}`, '', '| Task | What | Project | Result | Usability (clicks·disc·clarity → overall) |', '|---|---|---|---|---|');
  for (const r of rows.filter((x) => x.role === role).sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }) || a.project.localeCompare(b.project))) {
    const u = r.ux ? `${r.ux.clickScore}·${r.ux.discScore}·${r.ux.clarity} → **${r.ux.overall}**` : '–';
    L.push(`| ${r.id} | ${esc(r.title)} | ${r.project} | ${icon(r.status)} | ${u} |`);
  }
  L.push('');
}

L.push('## Failures (with evidence and repro)', '');
fails.forEach((r, i) => {
  L.push(`### F${i + 1}. [${r.role}] ${r.id} — ${esc(r.title)} (${r.project})`, '');
  const h = hintFor(r.full + '\n' + r.error);
  L.push('```', firstLines(r.error, 6) || '(no message)', '```');
  if (h) L.push(`- **Likely cause / fix:** ${h.hint}`);
  if (r.shots.length) L.push(`- **Screenshot:** ${r.shots.join(', ')}`);
  if (r.trace) L.push(`- **Trace:** ${r.trace} (open with \`npx playwright show-trace <path>\`)`);
  const repro = r.repro.length ? r.repro : r.steps;
  if (repro.length) { L.push('- **Repro:**'); repro.slice(0, 30).forEach((s, k) => L.push(`  ${k + 1}. ${s.trim()}`)); }
  L.push(`- **Spec:** ${r.file}`, '');
});

const uxRows = rows.filter((r) => r.ux?.overall);
L.push('## Usability scores (1–5)', '', 'Clicks: ≤4 interactions = 5 … >15 = 1 (login excluded). Discoverability: primary nav/home 5, in-page link 4, “More” menu 3, command palette 2, had to type the URL 1. Clarity starts at 5 and loses points for missing/unclear feedback.', '');
L.push('### Lowest-scoring tasks (≤ 3.5)', '', '| Score | Role | Task | Interactions | Found via | Clarity | Notes |', '|---:|---|---|---:|---|---:|---|');
for (const r of uxRows.filter((r) => r.ux.overall <= 3.5).sort((a, b) => a.ux.overall - b.ux.overall)) L.push(`| ${r.ux.overall} | ${r.role} | ${r.id} ${esc(r.ux.task || r.title)} | ${r.ux.interactions} | ${r.ux.discoverability} | ${r.ux.clarity} | ${esc((r.ux.notes ?? []).join('; '))} |`);
L.push('', '<details><summary>All task scores</summary>', '', '| Score | Role | Task | Interactions | Found via | Clarity |', '|---:|---|---|---:|---|---:|');
for (const r of uxRows.sort((a, b) => a.role.localeCompare(b.role) || a.id.localeCompare(b.id, 'en', { numeric: true }))) L.push(`| ${r.ux.overall} | ${r.role} | ${r.id} ${esc(r.ux.task || r.title)} | ${r.ux.interactions} | ${r.ux.discoverability} | ${r.ux.clarity} |`);
L.push('', '</details>', '');

const ax = rows.flatMap((r) => r.a11y.map((v: any) => ({ ...v, role: r.role })));
const byRule = new Map<string, { impact: string; help: string; pages: Set<string>; nodes: number; sample: string }>();
for (const v of ax) { const e = byRule.get(v.id) ?? { impact: v.impact, help: v.help, pages: new Set(), nodes: 0, sample: v.sample }; e.pages.add(v.page); e.nodes += v.nodes; byRule.set(v.id, e); }
const rank: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };
L.push('## Accessibility (axe-core, WCAG 2.1 A/AA)', '', `${byRule.size} distinct rules violated across ${new Set(ax.map((v: any) => v.page)).size} pages.`, '', '| Impact | Rule | Elements | Pages | Example selector | What it means |', '|---|---|---:|---|---|---|');
for (const [id, e] of [...byRule].sort((a, b) => (rank[a[1].impact] ?? 9) - (rank[b[1].impact] ?? 9) || b[1].nodes - a[1].nodes)) L.push(`| ${e.impact} | \`${id}\` | ${e.nodes} | ${esc([...e.pages].join(', '))} | \`${esc(e.sample).slice(0, 80)}\` | ${esc(e.help)} |`);

const dg = new Map<string, { n: number; who: Set<string>; at: Set<string> }>();
for (const r of rows) for (const d of r.diag) { if (d.kind === 'http' && /^40[13] /.test(d.text)) continue; const k = `${d.kind}: ${String(d.text).replace(/\/\d+(?=\/|$|\?)/g, '/:id')}`; const e = dg.get(k) ?? { n: 0, who: new Set(), at: new Set() }; e.n++; e.who.add(d.who); e.at.add(d.at); dg.set(k, e); }
L.push('', '## Console errors and failed network calls (all viewports, excluding expected 401/403)', '', '| Count | Signal | Roles | Pages |', '|---:|---|---|---|');
for (const [k, e] of [...dg].sort((a, b) => b[1].n - a[1].n).slice(0, 40)) L.push(`| ${e.n} | ${esc(k).slice(0, 180)} | ${[...e.who].slice(0, 5).join(', ')} | ${esc([...e.at].slice(0, 4).join(', '))} |`);
L.push('');
fs.writeFileSync(path.join(OUT, 'E2E_RESULTS.md'), L.join('\n'));

// FAILURES.md — actionable, grouped by area
const F: string[] = ['# FAILURES — actionable list for the fixer', '', `Run ${now} against /workspace/hrms-fix @ ${fixHead}${dirty}. ${tot.fail} failing of ${tot.all}. Regenerated on every run by \`npm run e2e\` in /workspace/hrms-e2e.`, '', 'Re-run one item: `cd /workspace/hrms-e2e && npx playwright test -g "<ID>"` (servers: `bash scripts/start-servers.sh`).', ''];
const groups = new Map<string, Row[]>();
for (const r of fails) { const a = hintFor(r.full + '\n' + r.error)?.area ?? area(r); groups.set(a, [...(groups.get(a) ?? []), r]); }
for (const [a, rr] of [...groups].sort((x, y) => y[1].length - x[1].length)) {
  F.push(`## ${a} (${rr.length})`, '');
  const hints = [...new Set(rr.map((r) => hintFor(r.full + '\n' + r.error)?.hint).filter(Boolean))];
  for (const h of hints) F.push(`> **Fix:** ${h}`);
  if (hints.length) F.push('');
  for (const r of rr) {
    const i = fails.indexOf(r) + 1;
    F.push(`- [ ] **F${i} [${r.role}] ${r.id}** ${r.title} _(${r.project})_`);
    F.push(`  - Expected vs actual: ${esc(firstLines(r.error, 3)).slice(0, 400)}`);
    if (r.shots[0]) F.push(`  - Evidence: ${r.shots[0]}${r.trace ? ` · trace ${r.trace}` : ''}`);
  }
  F.push('');
}
fs.writeFileSync(path.join(OUT, 'FAILURES.md'), F.join('\n'));
console.log(`E2E_RESULTS.md + FAILURES.md written to ${OUT}: ${tot.all} tests, ${tot.pass} pass, ${tot.fail} fail, ${tot.skip} skip`);
