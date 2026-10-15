/** NFR-03/04: bind HTTP fixtures to the exact loopback address clients use. */
import { createServer, type Server } from 'node:http';
import type { Express } from 'express';
import supertest from 'supertest';
import { afterAll } from 'vitest';

// Auto-created Supertest listeners can bind another address family while the
// client connects to 127.0.0.1. Explicit binding also preserves one app/listener
// for rate-limit and cookie tests; every server is closed after the file.
const servers = new Map<Express, Promise<Server>>();

function listener(app: Express): Promise<Server> {
  const existing = servers.get(app);
  if (existing) return existing;
  const ready = new Promise<Server>((resolve, reject) => {
    const server = createServer(app);
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server);
    });
  });
  servers.set(app, ready);
  return ready;
}

export async function httpRequest(app: Express): Promise<ReturnType<typeof supertest>> {
  return supertest(await listener(app));
}

export async function httpAgent(app: Express): Promise<ReturnType<typeof supertest.agent>> {
  return supertest.agent(await listener(app));
}

afterAll(async () => {
  for (const ready of servers.values()) {
    const server = await ready;
    await new Promise<void>((resolve, reject) => {
      server.close(error => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
  servers.clear();
});
