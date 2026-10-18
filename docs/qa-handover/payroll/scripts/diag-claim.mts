// QA diagnostic (rolled back): real error behind POST /api/claims/submit 500.
import 'dotenv/config';
import { createDatabase } from '/workspace/hrms/backend/src/core/db/database.js';
import { ClaimsService } from '/workspace/hrms/backend/src/modules/claims/claims.service.js';
const db = createDatabase(process.env.DATABASE_URL!);
class Rollback extends Error {}
try {
  await db.transaction().execute(async (trx) => {
    const r = await new ClaimsService(trx as any).submitClaim({ employeeId: 31, claimTypeCode: 'hotel', periodFrom: '2026-09-01', periodTo: '2026-09-30',
      bills: [{ documentId: 4, amountRupees: 1200, billNo: 'B1', billDate: '2026-09-10' }] } as any);
    console.log('OK (rolled back):', JSON.stringify(r)); throw new Rollback();
  });
} catch (e) { if (!(e instanceof Rollback)) { console.log('ERROR:', (e as Error).message); console.log((e as Error).stack?.split('\n').slice(1, 8).join('\n')); } }
await db.destroy();
