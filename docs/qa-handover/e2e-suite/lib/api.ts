/** Thin API client over Playwright's request context (same backend the UI proxies to). */
import { request as pwRequest, type APIRequestContext, type APIResponse } from '@playwright/test';
import { API_URL } from './env';
import { PASSWORD } from './personas';

export interface ApiClient {
  token: string;
  ctx: APIRequestContext;
  get(path: string): Promise<APIResponse>;
  post(path: string, body?: unknown): Promise<APIResponse>;
  put(path: string, body?: unknown): Promise<APIResponse>;
  del(path: string): Promise<APIResponse>;
  json<T = any>(res: APIResponse): Promise<T>;
  dispose(): Promise<void>;
}

export async function apiLogin(email: string, password = PASSWORD): Promise<ApiClient> {
  const ctx = await pwRequest.newContext({ baseURL: API_URL });
  const res = await ctx.post('/api/auth/login', { data: { identifier: email, password } });
  if (!res.ok()) throw new Error(`API login failed for ${email}: ${res.status()} ${await res.text()}`);
  const { accessToken } = await res.json();
  const h = { authorization: `Bearer ${accessToken}` };
  return {
    token: accessToken, ctx,
    get: (p) => ctx.get(p, { headers: h }),
    post: (p, body) => ctx.post(p, { headers: h, data: body ?? {} }),
    put: (p, body) => ctx.put(p, { headers: h, data: body ?? {} }),
    del: (p) => ctx.delete(p, { headers: h }),
    json: async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return t as any; } },
    dispose: () => ctx.dispose(),
  };
}

export async function anonApi(): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: API_URL });
}
