// QA diagnostic (rolled back): surfaces the real error behind POST /payroll/outputs/generateRunPayslips 500.
import 'dotenv/config';
import { createDatabase } from '/workspace/hrms/backend/src/core/db/database.js';
import { PayslipGeneratorService } from '/workspace/hrms/backend/src/modules/payroll-outputs/payslip/payslip-generator.js';
const db = createDatabase(process.env.DATABASE_URL!);
class Rollback extends Error {}
try {
  await db.transaction().execute(async (trx) => {
    const r = await new PayslipGeneratorService(trx).generateRunPayslips(Number(process.argv[2]), 4);
    console.log('OK (rolled back):', JSON.stringify(r)); throw new Rollback();
  });
} catch (e) { if (!(e instanceof Rollback)) { console.log('ERROR:', (e as Error).message); console.log((e as Error).stack?.split('\n').slice(1, 6).join('\n')); } }
await db.destroy();
