// QA diagnostic: replays a payroll-run procedure inside a transaction that is always rolled back, to surface the
// real error message hidden behind the API's generic 500. Usage: diag-run.ts <compute|approve|finalize|review> <runId> <userId>
import 'dotenv/config';
import { createDatabase } from '/workspace/hrms/backend/src/core/db/database.js';
import { PayrollRunService } from '/workspace/hrms/backend/src/modules/payroll-core/runs/run.service.js';
const db = createDatabase(process.env.DATABASE_URL!);
const [op, runId, userId] = [process.argv[2]!, Number(process.argv[3]), Number(process.argv[4] ?? 4)];
class Rollback extends Error {}
try {
  await db.transaction().execute(async (trx) => {
    const svc = new PayrollRunService(trx);
    const r = await (svc as any)[op === 'compute' ? 'computeRun' : op === 'approve' ? 'approveRun' : op === 'finalize' ? 'finalizeRun' : 'reviewRun'](runId, userId);
    console.log('OK (rolled back):', JSON.stringify(r));
    throw new Rollback();
  });
} catch (e) { if (!(e instanceof Rollback)) { console.log('ERROR:', (e as Error).message); console.log((e as Error).stack?.split('\n').slice(1, 4).join('\n')); } }
await db.destroy();
