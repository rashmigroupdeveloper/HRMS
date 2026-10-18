/**
 * Kent CamAttendance simulator (docs/integrations/KENT.md). Events use Kent's documented webhook
 * shape (empId, employeeName, time, type, deviceId, deviceName, locationName, ...). It offers:
 *  - Style A (default adapter config): GET /punches?since&limit&cursor → {items,nextCursor}, X-API-Key,
 *    filtered by receivedAt; GET /devices.
 *  - Style B (a typical custom Kent API): POST /api/login {username,password} → {data:{token}};
 *    GET /api/recognition-logs?fromDate&page&pageSize with Bearer → {data:{records}}, filtered by
 *    PUNCH time (so late uploads need KENT_REREAD_DAYS); epoch-second times.
 *  - pushWebhook(url, events): POSTs a JSON array the way Kent's webhook does.
 * Fault injection: HTTP 503 every Nth authenticated call.
 */
import { createServer, type Server } from 'node:http';

export interface SimEvent {
  empId: string; employeeName?: string; time: string | number; type?: 0 | 1; deviceId: string; deviceName?: string;
  locationName?: string; imageUrl?: string; direction?: 'in' | 'out'; cardNo?: string; receivedAt?: string;
}
export interface SimDevice { deviceId: string; lastSeen?: string; completeThrough?: string }

export function createKentSimulator(opts: { apiKey: string; failEvery?: number | undefined; login?: { username: string; password: string } }) {
  const events: SimEvent[] = [];
  const devices = new Map<string, SimDevice>();
  const tokens = new Set<string>();
  let calls = 0;
  const timeMs = (e: SimEvent) => (typeof e.time === 'number' ? (e.time < 1e12 ? e.time * 1000 : e.time) : Date.parse(e.time));
  const add = (list: SimEvent[]) => {
    for (const p of list) {
      events.push(p);
      if (p.receivedAt) { const d = devices.get(p.deviceId) ?? { deviceId: p.deviceId }; d.lastSeen = p.receivedAt; d.completeThrough = p.receivedAt; devices.set(p.deviceId, d); }
    }
  };
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://sim');
    const send = (status: number, body: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    const readBody = (fn: (raw: string) => void) => { let raw = ''; req.on('data', (c: Buffer) => { raw += c.toString(); }); req.on('end', () => { fn(raw); }); };
    if (req.method === 'POST' && url.pathname === '/_sim/punches') {
      readBody((raw) => { try { const list = JSON.parse(raw) as SimEvent[]; add(list); send(200, { stored: list.length }); } catch { send(400, { error: 'expected a JSON array of events' }); } });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/login') {
      readBody((raw) => {
        let b: { username?: string; password?: string } = {};
        try { b = JSON.parse(raw) as typeof b; } catch { /* empty */ }
        if (!opts.login || b.username !== opts.login.username || b.password !== opts.login.password) { send(401, { error: 'bad credentials' }); return; }
        const t = `tok-${String(tokens.size + 1)}-${String(Date.now())}`; tokens.add(t); send(200, { data: { token: t } });
      });
      return;
    }
    const bearer = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    const authed = url.pathname.startsWith('/api/') ? tokens.has(bearer) : req.headers['x-api-key'] === opts.apiKey;
    if (!authed) { send(401, { error: 'unauthorized' }); return; }
    calls++;
    if (opts.failEvery && calls % opts.failEvery === 0) { send(503, { error: 'simulated outage' }); return; }
    if (req.method === 'GET' && url.pathname === '/punches') {
      const since = Date.parse(url.searchParams.get('since') ?? '1970-01-01T00:00:00Z');
      const limit = Math.max(1, Math.min(5000, Number(url.searchParams.get('limit') ?? 1000)));
      const start = Number(url.searchParams.get('cursor') ?? 0);
      const matching = events.filter((p) => Date.parse(p.receivedAt ?? new Date(timeMs(p)).toISOString()) > since);
      send(200, { items: matching.slice(start, start + limit), nextCursor: start + limit < matching.length ? String(start + limit) : null });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/devices') { send(200, { items: [...devices.values()] }); return; }
    if (req.method === 'GET' && url.pathname === '/api/recognition-logs') {
      const from = Number(url.searchParams.get('fromDate') ?? 0) * 1000;
      const size = Math.max(1, Math.min(500, Number(url.searchParams.get('pageSize') ?? 100)));
      const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
      const matching = events.filter((p) => timeMs(p) >= from).map((p) => ({ ...p, time: Math.floor(timeMs(p) / 1000) }));
      send(200, { data: { records: matching.slice((page - 1) * size, page * size) } });
      return;
    }
    send(404, { error: 'not found' });
  });
  return {
    server,
    listen: (port = 0) => new Promise<number>((resolve) => { server.listen(port, '127.0.0.1', () => { const a = server.address(); resolve(typeof a === 'object' && a ? a.port : port); }); }),
    close: () => new Promise<void>((resolve) => { server.close(() => { resolve(); }); }),
    add,
    /** POST events to an HRMS webhook URL exactly like Kent's portal webhook (JSON array). */
    pushWebhook: async (webhookUrl: string, list: SimEvent[]) => {
      const r = await fetch(webhookUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(list) });
      return { status: r.status, body: await r.json() };
    },
  };
}
