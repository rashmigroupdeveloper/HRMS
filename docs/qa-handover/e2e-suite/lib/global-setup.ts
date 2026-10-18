/** Once per run: bring the e2e DB to the state a live system has after its nightly jobs (KPI snapshot built). */
import { apiLogin } from './api';

export default async function globalSetup() {
  const sa = await apiLogin('admin@rashmi.test').catch(() => null);
  if (!sa) return;
  try {
    if ((await sa.get('/api/reports/executive')).status() === 404) await sa.post('/api/reports/executive/rebuild', {});
  } finally { await sa.dispose(); }
}
