/**
 * Kent feed simulator — serves the documented contract (docs/integrations/KENT.md) so the
 * adapter, pipeline, muster and payroll can be exercised end to end before the real API is
 * attached. Punches are posted in (or generated) and served with cursors, API-key auth and
 * optional fault injection (HTTP 503 every Nth call) to prove retry behaviour.
 */
import { createServer, type Server } from 'node:http';

export interface SimPunch { employeeNo: string; cardNo?: string; punchTime: string; deviceId: string; direction?: 'in' | 'out'; receivedAt: string }
export interface SimDevice { deviceId: string; lastSeen?: string; completeThrough?: string }

export function createKentSimulator(opts: { apiKey: string; failEvery?: number | undefined }) {
  const punches: SimPunch[] = [];
  const devices = new Map<string, SimDevice>();
  let calls = 0;
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://sim');
    const send = (status: number, body: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.method === 'POST' && url.pathname === '/_sim/punches') {
      let raw = '';
      req.on('data', (c: Buffer) => { raw += c.toString(); });
      req.on('end', () => {
        try {
          const list = JSON.parse(raw) as SimPunch[];
          for (const p of list) {
            punches.push(p);
            const d = devices.get(p.deviceId) ?? { deviceId: p.deviceId };
            d.lastSeen = p.receivedAt; d.completeThrough = p.receivedAt; devices.set(p.deviceId, d);
          }
          send(200, { stored: list.length });
        } catch { send(400, { error: 'expected a JSON array of punches' }); }
      });
      return;
    }
    if (req.headers['x-api-key'] !== opts.apiKey) { send(401, { error: 'bad api key' }); return; }
    calls++;
    if (opts.failEvery && calls % opts.failEvery === 0) { send(503, { error: 'simulated outage' }); return; }
    if (req.method === 'GET' && url.pathname === '/punches') {
      const since = Date.parse(url.searchParams.get('since') ?? '1970-01-01T00:00:00Z');
      const limit = Math.max(1, Math.min(5000, Number(url.searchParams.get('limit') ?? 1000)));
      const start = Number(url.searchParams.get('cursor') ?? 0);
      const matching = punches.filter((p) => Date.parse(p.receivedAt) > since);
      const items = matching.slice(start, start + limit);
      send(200, { items, nextCursor: start + limit < matching.length ? String(start + limit) : null });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/devices') { send(200, { items: [...devices.values()] }); return; }
    send(404, { error: 'not found' });
  });
  return {
    server,
    listen: (port = 0) => new Promise<number>((resolve) => { server.listen(port, '127.0.0.1', () => { const a = server.address(); resolve(typeof a === 'object' && a ? a.port : port); }); }),
    close: () => new Promise<void>((resolve) => { server.close(() => { resolve(); }); }),
    add: (list: SimPunch[]) => { for (const p of list) { punches.push(p); const d = devices.get(p.deviceId) ?? { deviceId: p.deviceId }; d.lastSeen = p.receivedAt; d.completeThrough = p.receivedAt; devices.set(p.deviceId, d); } },
  };
}
