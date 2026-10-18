/** Run the Kent simulator locally: KENT_SIM_PORT=5199 KENT_API_KEY=dev npx tsx scripts/kent-simulator.ts
 *  Pull (style A): KENT_BASE_URL=http://127.0.0.1:5199 KENT_API_KEY=dev on the backend, then POST events to /_sim/punches.
 *  Pull (style B): KENT_SIM_LOGIN=user:pass and the KENT_AUTH=login settings in docs/integrations/KENT.md.
 *  Webhook: KENT_SIM_PUSH_TO=<https://host/api/integrations/kent/webhook/<token>> pushes one sample event at start. */
import { createKentSimulator } from '../src/modules/attendance/kent-simulator.js';

const [username = '', password = ''] = (process.env['KENT_SIM_LOGIN'] ?? '').split(':');
const sim = createKentSimulator({
  apiKey: process.env['KENT_API_KEY'] ?? 'dev',
  failEvery: Number(process.env['KENT_SIM_FAIL_EVERY'] ?? 0) || undefined,
  ...(username ? { login: { username, password } } : {}),
});
const port = await sim.listen(Number(process.env['KENT_SIM_PORT'] ?? 5199));
console.log(`Kent simulator on http://127.0.0.1:${String(port)} (POST /_sim/punches, GET /punches, GET /devices, POST /api/login, GET /api/recognition-logs)`);
const pushTo = process.env['KENT_SIM_PUSH_TO'];
if (pushTo) {
  const empId = process.env['KENT_SIM_EMP'] ?? 'RML033625';
  console.log('webhook push →', await sim.pushWebhook(pushTo, [{ empId, employeeName: 'Simulated', time: Math.floor(Date.now() / 1000), type: 1, deviceId: 'SIM-DEV-1', deviceName: 'Seamless-Plant_S4', locationName: '44' }]));
}
