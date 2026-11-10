import assert from 'node:assert/strict';
import { once } from 'node:events';
import test, { after, before } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import type { Server } from 'node:http';

let app: Express;
let server: Server;
let baseUrl: string;

before(async () => {
  // Make server.ts treat this as a production-like Vercel instance and ensure
  // no real local credentials are loaded or used by these endpoint tests.
  Object.assign(process.env, {
    VERCEL: '1',
    NODE_ENV: 'production',
    VITE_FIREBASE_PROJECT_ID: 'demo-security-test',
    GOOGLE_SERVICE_ACCOUNT_EMAIL: 'google-test@example.invalid',
    GOOGLE_PRIVATE_KEY: 'invalid-test-key',
    GOOGLE_SHEET_ID_CONTACT: 'not-a-real-sheet',
    FIREBASE_SERVICE_ACCOUNT_EMAIL: 'firebase-test@example.invalid',
    FIREBASE_PRIVATE_KEY: 'invalid-test-key',
    CLIENT_URL: '',
    FRONTEND_URL: '',
    VERCEL_URL: '',
  });

  ({ default: app } = await import('../server'));
  server = app.listen(0);
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server?.listening) {
    server.close();
    await once(server, 'close');
  }
});

test('health endpoint does not disclose environment or runtime details', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('article sync rejects requests without a verified admin token', async () => {
  const response = await fetch(`${baseUrl}/api/articles/sync`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ articles: [{ id: 'attacker-content' }] }),
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).success, false);
});

test('note link writes reject requests without a verified admin token', async () => {
  const response = await fetch(`${baseUrl}/api/notes/link`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.invalid', title: 'test', subjectId: 'test' }),
  });
  assert.equal(response.status, 401);
});

test('untrusted origins cannot make credentialed cross-origin requests', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: { origin: 'https://attacker.example' },
  });
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('unknown API routes return a JSON 404', async () => {
  const response = await fetch(`${baseUrl}/api/no-such-route`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, 'API endpoint not found.');
});
