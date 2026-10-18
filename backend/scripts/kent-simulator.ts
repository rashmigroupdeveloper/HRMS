/** Run the Kent simulator locally: KENT_SIM_PORT=5199 KENT_API_KEY=dev npx tsx scripts/kent-simulator.ts
 *  Then set KENT_BASE_URL=http://127.0.0.1:5199 KENT_API_KEY=dev on the backend and POST punches to /_sim/punches. */
import { createKentSimulator } from '../src/modules/attendance/kent-simulator.js';

const sim = createKentSimulator({ apiKey: process.env['KENT_API_KEY'] ?? 'dev', failEvery: Number(process.env['KENT_SIM_FAIL_EVERY'] ?? 0) || undefined });
const port = await sim.listen(Number(process.env['KENT_SIM_PORT'] ?? 5199));
console.log(`Kent simulator on http://127.0.0.1:${String(port)} (POST /_sim/punches, GET /punches, GET /devices)`);
