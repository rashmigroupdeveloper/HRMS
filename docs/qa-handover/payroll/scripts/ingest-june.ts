// QA-only test feed: pushes synthetic June-2026 Kent swipes through the app's own ingestion pipeline
// (runKentSync -> ingestOnce -> device heartbeat/watermark -> drainRecomputeQueue). The app ships no
// real Kent adapter (KentIntegrationUnavailable), so a test connector is injected exactly as the repo's tests do.
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { sql } from 'kysely';
import { createDatabase } from '/workspace/hrms/backend/src/core/db/database.js';
import { runKentSync } from '/workspace/hrms/backend/src/modules/attendance/kent-sync.job.js';
import { drainRecomputeQueue } from '/workspace/hrms/backend/src/modules/attendance/day-status.service.js';
import type { KentConnector, RawSwipe, DeviceInfo } from '/workspace/hrms/backend/src/modules/attendance/kent-connector.js';
const db = createDatabase(process.env.DATABASE_URL!);
const phase = process.argv[2] ?? 'swipes';
const C = JSON.parse(readFileSync('/workspace/hrms-test/payroll/cohort.json', 'utf8'));
const doors: Record<number, string> = { 1: 'KGP-GATE1', 2: 'RGH-GATE1', 3: 'BBS-GATE1' };
const ist = (d: string, hm: string) => new Date(`${d}T${hm}:00+05:30`);
async function main() {
  const now = new Date();
  const devices: DeviceInfo[] = Object.values(doors).map((doorCode) => ({ doorCode, lastContactAt: now, watermarkTs: now }));
  const swipes: RawSwipe[] = [];
  if (phase === 'swipes') {
    const emps = await db.selectFrom('core.employees').select(['id', 'ecode', 'doj', 'dol', 'location_id', 'company_id'])
      .where('company_id', 'in', [1, 2]).where('status', 'in', ['active', 'on_notice', 'exited'])
      .where('doj', '<', sql<Date>`'2026-07-01'::date`).where((eb) => eb.or([eb('dol', 'is', null), eb('dol', '>=', sql<Date>`'2026-06-01'::date`)])).execute();
    const plan = new Map<string, any>(C.map((e: any) => [e.ecode, e]));
    const leaveDays = await db.selectFrom('att.day_records').select(['employee_id', sql<string>`work_date::text`.as('d')]).where('leave_type_id', 'is not', null)
      .where('work_date', '>=', sql<Date>`'2026-06-01'::date`).where('work_date', '<', sql<Date>`'2026-07-01'::date`).execute();
    const onLeave = new Set(leaveDays.map((r) => `${r.employee_id}|${r.d}`));
    for (const e of emps) {
      const p = plan.get(e.ecode) ?? { att: {} };
      const absent: string[] | 'ALL' = p.att?.absent ?? [];
      const doj = e.doj!.toISOString().slice(0, 10); const dol = e.dol ? e.dol.toISOString().slice(0, 10) : '9999-12-31';
      for (let day = 1; day <= 30; day++) {
        const d = `2026-06-${String(day).padStart(2, '0')}`;
        const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
        if (dow === 0 || d < doj || d > dol) continue;
        if (absent === 'ALL' || absent.includes(d) || onLeave.has(`${e.id}|${d}`)) continue;
        if (e.ecode === 'RML033904' && d >= '2026-06-08') continue; // maternity (ML rejected by app) -> no swipes
        const door = doors[e.location_id ?? 1]!;
        const jitter = (e.id * 7 + day * 3) % 9; // 0..8 min
        const tin = ist(d, `08:${String(50 + jitter).padStart(2, '0')}`);
        const outHm = p.att?.ot === d ? '22:00' : `18:0${jitter % 9}`;
        const tout = ist(d, outHm);
        swipes.push({ employeeNo: e.ecode, swipeTs: tin, doorCode: door, direction: 'in', receivedAt: new Date(tin.getTime() + 60_000) });
        swipes.push({ employeeNo: e.ecode, swipeTs: tout, doorCode: door, direction: 'out', receivedAt: new Date(tout.getTime() + 60_000) });
      }
    }
  }
  const connector: KentConnector = { fetchSince: async () => swipes, listDevices: async () => devices };
  const r = await runKentSync(db, connector);
  let drained = r.daysRecomputed, n;
  for (let i = 0; i < 40 && (n = await drainRecomputeQueue(db)) > 1; i++) drained += n;
  const out = { phase, swipesPushed: swipes.length, ...r, totalDrained: drained };
  console.log(JSON.stringify(out));
  writeFileSync(`/workspace/hrms-test/payroll/logs/ingest-${phase}.json`, JSON.stringify(out, null, 1));
  await db.destroy();
}
main().catch(async (e) => { console.error(e); await db.destroy(); process.exit(1); });
