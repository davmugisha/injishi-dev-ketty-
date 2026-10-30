import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

import { readConfig } from '../src/config.ts';
import { buildMockApis, type MockApis } from '../src/server.ts';

/**
 * The providers as the API's sandbox adapters meet them: over HTTP, with each
 * provider's own authentication, answering from the seeded registers.
 */

const SECRET = 'injishi-mock-apis-test-secret';
let mock: MockApis;
let base = '';

before(async () => {
  const config = readConfig({
    MOCK_APIS_DATA_DIR: 'memory',
    MOCK_APIS_SECRET: SECRET,
    MOCK_MOMO_APPROVAL_MS: '150',
    MOCK_MOMO_HANG_MS: '0',
    MOCK_SMILE_JOB_MS: '0',
  });
  mock = buildMockApis(config, { quiet: true });
  await new Promise<void>((resolve) => mock.server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(mock.server.address() as AddressInfo).port}`;
});

after(() => {
  mock.stop();
  mock.server.close();
});

async function call(path: string, init: RequestInit = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${base}${path}`, init);
  const text = await response.text();
  return { status: response.status, body: text ? (JSON.parse(text) as Record<string, unknown>) : {} };
}

async function image(path: string): Promise<string> {
  const response = await fetch(`${base}${path}`);
  assert.equal(response.status, 200);
  return Buffer.from(await response.arrayBuffer()).toString('base64');
}

async function gtbankToken(): Promise<string> {
  const { status, body } = await call('/gtbank/oauth/token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`injishi-sandbox:${SECRET}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  assert.equal(status, 200);
  return String(body.access_token);
}

describe('RRA taxpayer register', () => {
  const rra = (tin: string, key = SECRET) => call(`/rra/v1/taxpayers/${tin}`, { headers: { 'x-api-key': key } });

  it('answers a seeded taxpayer with its directors by document', async () => {
    const { status, body } = await rra('998000004');
    assert.equal(status, 200);
    assert.equal(body.taxpayerName, 'Akagera Safari Camps Ltd');
    assert.deepEqual(
      (body.directors as Array<{ idType: string; idNumber: string }>).map((d) => [d.idType, d.idNumber]),
      [
        ['PASSPORT', 'P10000001'],
        ['NATIONAL_ID', '1198280099012378'],
      ],
    );
  });

  it('makes up the generated blocks, and refuses everything else', async () => {
    const generated = await rra('998212345');
    assert.equal(generated.status, 200);
    assert.equal((generated.body.directors as unknown[]).length, 2);
    assert.equal((await rra('123456789')).status, 404);
    assert.equal((await rra('12345')).status, 400);
  });

  it('plays the scenarios: a closed TIN and an outage', async () => {
    assert.equal((await rra('998000097')).body.status, 'DEREGISTERED');
    assert.equal((await rra('998000098')).status, 503);
  });

  it('refuses a wrong key', async () => {
    assert.equal((await rra('998000001', 'nope-nope-nope-nope')).status, 401);
  });
});

describe('GTBank NIDA gateway', () => {
  const verify = async (documentNumber: string, selfiePath: string) => {
    const token = await gtbankToken();
    return call('/gtbank/nida/v1/identity-verifications', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        requestReference: `test-${documentNumber}-${Math.random()}`,
        documentNumber,
        selfie: { mimeType: 'image/png', data: await image(selfiePath) },
      }),
    });
  };

  it('matches a citizen to their own demo selfie', async () => {
    const { status, body } = await verify('1198870034567812', '/__mock/documents/citizens/1198870034567812/selfie.png');
    assert.equal(status, 200);
    assert.equal(body.result, 'MATCH');
    assert.equal((body.citizen as { surname: string }).surname, 'Uwase');
  });

  it("refuses someone else's selfie, and plays each scenario", async () => {
    const aline = '/__mock/documents/citizens/1198870034567812/selfie.png';
    assert.equal((await verify('1198580045678923', aline)).body.result, 'NO_MATCH');
    assert.equal((await verify('1198770066789045', aline)).body.result, 'REVOKED');
    assert.equal((await verify('1199170088901267', aline)).body.result, 'NOT_CHECKED');
    assert.equal((await verify('1199380077890156', '/__mock/documents/citizens/1199380077890156/selfie.png')).body.result, 'NO_MATCH');
    assert.equal((await verify('1199080000000012', aline)).body.result, 'NOT_FOUND');
    assert.equal((await verify('1199089999999012', aline)).status, 503);
  });

  it('refuses a request without a token', async () => {
    const { status } = await call('/gtbank/nida/v1/citizens/1198870034567812');
    assert.equal(status, 401);
  });
});

describe('GTBank Payment Hub', () => {
  const collect = async (token: string, clientReference: string, msisdn: string, amount = 50_000) =>
    call('/gtbank/payment-hub/v1/collections', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ clientReference, amount, currency: 'RWF', payer: { msisdn, network: 'MTN' } }),
    });
  const read = (token: string, reference: string) =>
    call(`/gtbank/payment-hub/v1/transactions/${reference}`, { headers: { authorization: `Bearer ${token}` } });

  it('prompts, then settles once the handset approves', async () => {
    const token = await gtbankToken();
    const first = await collect(token, 'ws:registration_fee:a', '+250788300412');
    assert.equal(first.status, 202);
    assert.equal(first.body.status, 'pending');
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal((await read(token, String(first.body.transactionReference))).body.status, 'successful');
  });

  it('answers a replay with the same transaction, and refuses the key for another amount', async () => {
    const token = await gtbankToken();
    const first = await collect(token, 'ws:registration_fee:b', '+250788300412');
    const again = await collect(token, 'ws:registration_fee:b', '+250788300412');
    assert.equal(again.status, 200);
    assert.equal(again.body.transactionReference, first.body.transactionReference);
    assert.equal((await collect(token, 'ws:registration_fee:b', '+250788300412', 1)).status, 409);
  });

  it('lets the console decide a manual prompt, and finds it by our reference', async () => {
    const token = await gtbankToken();
    const prompt = await collect(token, 'ws:registration_fee:c', '+250788300523');
    const reference = String(prompt.body.transactionReference);
    const declined = await call(`/__mock/transactions/${reference}/decline`, { method: 'POST' });
    assert.equal(declined.body.status, 'rejected');
    const found = await call('/gtbank/payment-hub/v1/transactions?clientReference=ws:registration_fee:c&type=collection', {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal((found.body.items as Array<{ status: string }>)[0]?.status, 'rejected');
  });

  it('refuses a number on the wrong network', async () => {
    const token = await gtbankToken();
    const { status } = await call('/gtbank/payment-hub/v1/collections', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ clientReference: 'x', amount: 10, currency: 'RWF', payer: { msisdn: '+250732845190', network: 'MTN' } }),
    });
    assert.equal(status, 422);
  });
});

describe('Smile ID document verification', () => {
  const partner = '1001';
  const sign = () => {
    const timestamp = new Date().toISOString();
    return { timestamp, signature: createHmac('sha256', SECRET).update(timestamp + partner + 'sid_request').digest('base64') };
  };

  const run = async (passport: string, selfieOf: string) => {
    const jobId = `job-${passport}-${selfieOf}-${Math.random()}`;
    const prep = await call('/smile-id/v1/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...sign(), smile_client_id: partner, partner_params: { job_id: jobId, user_id: 'u', job_type: 6 } }),
    });
    assert.equal(prep.status, 200);
    const uploaded = await fetch(String(prep.body.upload_url).replace(/^http:\/\/localhost:\d+/, base), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id_info: { country: 'KE', id_type: 'PASSPORT' },
        images: [
          { image_type_id: 3, image: await image(`/__mock/documents/passports/${passport}/photo-page.png`) },
          { image_type_id: 2, image: await image(`/__mock/documents/passports/${selfieOf}/selfie.png`) },
        ],
      }),
    });
    assert.equal(uploaded.status, 200);
    const status = await call('/smile-id/v1/job_status', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...sign(), partner_id: partner, user_id: 'u', job_id: jobId }),
    });
    assert.equal(status.body.job_complete, true);
    return status.body.result as { ResultCode: string; IDNumber?: string; Actions: Record<string, string> };
  };

  it('verifies a passport against its own selfie', async () => {
    const result = await run('P10000001', 'P10000001');
    assert.equal(result.ResultCode, '0810');
    assert.equal(result.IDNumber, 'P10000001');
  });

  it("refuses another person's selfie, an expired passport and a forgery", async () => {
    assert.equal((await run('P10000001', 'P10000005')).Actions.Selfie_To_ID_Card_Compare, 'Failed');
    assert.equal((await run('P10000002', 'P10000002')).Actions.Expiry_Check, 'Failed');
    assert.equal((await run('P10000003', 'P10000003')).Actions.Document_Check, 'Failed');
  });

  it('refuses an unsigned request', async () => {
    const { status } = await call('/smile-id/v1/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ timestamp: new Date().toISOString(), signature: 'bad', smile_client_id: partner, partner_params: { job_id: 'j', user_id: 'u', job_type: 6 } }),
    });
    assert.equal(status, 401);
  });
});
