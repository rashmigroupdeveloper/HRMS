// QA diagnostic (rolled back): real error behind POST /lifecycle/transfers/{id}/approve 500.
import 'dotenv/config';
import { createDatabase } from '/workspace/hrms/backend/src/core/db/database.js';
import * as T from '/workspace/hrms/backend/src/modules/lifecycle/transfers/transfer.service.js';
const db = createDatabase(process.env.DATABASE_URL!);
class Rollback extends Error {}
for (const id of process.argv.slice(2).map(Number)) {
  try {
    await db.transaction().execute(async (trx) => {
      (trx as any).transaction = () => ({ execute: (fn: any) => fn(trx) }); const px = trx;
      const r = await (T.approveTransferRequest as any)(px, id, 2);
      console.log(id, 'OK (rolled back):', JSON.stringify(r)); throw new Rollback();
    });
  } catch (e) { if (!(e instanceof Rollback)) { console.log(id, 'ERROR:', (e as Error).message); console.log((e as Error).stack?.split('\n').slice(1, 5).join('\n')); } }
}
await db.destroy();
