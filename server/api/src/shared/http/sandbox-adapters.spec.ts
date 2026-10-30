import { type ChildProcess, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { RraTinHttpAdapter } from '../../modules/organization/infrastructure/rra-tin-http.adapter';
import type { OneTimeFeeCommand } from '../../modules/pay/domain/payment-port';
import { GtbankPaymentAdapter } from '../../modules/pay/infrastructure/gtbank-payment.adapter';
import { GtbankNidaRegistry } from '../../modules/user/infrastructure/gtbank-nida.registry';
import type { DocumentCheck } from '../../modules/user/domain/identity-ports';
import { SmileIdDocumentVerifier } from '../../modules/user/infrastructure/smile-id-document.verifier';
import { sandboxCredentials } from '../config/mock-apis';

/**
 * The sandbox adapters against the real Injishi Mock APIs (`server/mock-apis`),
 * started as its own process on a free port: the same HTTP the API sends in
 * `sandbox` mode and will send a live provider. This is the conformance run
 * ADR-073 D-h asks a live adapter to pass against a scriptable fake provider,
 * on the wire as Injishi has modelled it.
 *
 * The two never import each other; this spec reaches the server by its path
 * and its port only.
 */

const SECRET = 'injishi-sandbox-spec-secret';
const credentials = sandboxCredentials(SECRET);
let child: ChildProcess;
let base = '';

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

beforeAll(async () => {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  const main = path.resolve(__dirname, '../../../../mock-apis/src/main.ts');
  child = spawn(process.execPath, [main], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      MOCK_APIS_PORT: String(port),
      MOCK_APIS_PUBLIC_URL: base,
      MOCK_APIS_DATA_DIR: 'memory',
      MOCK_APIS_SECRET: SECRET,
      MOCK_MOMO_APPROVAL_MS: '300',
      MOCK_SMILE_JOB_MS: '0',
      MOCK_MOMO_HANG_MS: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Injishi Mock APIs did not start within 15 s')), 15_000);
    child.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('Injishi Mock APIs on')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once('exit', (code) => reject(new Error(`Injishi Mock APIs exited with ${code}`)));
  });
}, 20_000);

afterAll(() => {
  child?.kill();
});

async function image(pathname: string): Promise<{ mime: string; bytes: Buffer }> {
  const response = await fetch(`${base}${pathname}`);
  return { mime: 'image/png', bytes: Buffer.from(await response.arrayBuffer()) };
}

describe('RRA TIN, sandbox', () => {
  const adapter = (): RraTinHttpAdapter =>
    new RraTinHttpAdapter({ mode: 'sandbox', baseUrl: `${base}/rra`, apiKey: credentials.rra.apiKey, timeoutMs: 5_000 });

  it('verifies a seeded taxpayer with its directors, stamped mock', async () => {
    const outcome = await adapter().verify('998000001');
    expect(outcome.result).toBe('verified');
    expect(outcome.adapterMode).toBe('mock');
    if (outcome.result !== 'verified') return;
    expect(outcome.business).toMatchObject({
      legalName: 'Uwase Hospitality Ltd',
      companyType: 'private_company',
      address: { provinceId: 1, districtId: 102, sectorId: 10201 },
      directors: [{ name: 'Aline Uwase', documentNumber: '1198870034567812' }],
      generated: true,
    });
    // The stored answer never carries a director's document number (ADR-060).
    expect(JSON.stringify(outcome.raw)).not.toContain('1198870034567812');
  });

  it('fails an unregistered or closed TIN, and holds an outage as pending', async () => {
    expect((await adapter().verify('123456789')).result).toBe('failed');
    expect((await adapter().verify('998000097')).result).toBe('failed');
    expect((await adapter().verify('998000098')).result).toBe('pending');
  });

  it('reads a refused key as pending, never as a failed business', async () => {
    const wrong = new RraTinHttpAdapter({ mode: 'sandbox', baseUrl: `${base}/rra`, apiKey: 'wrong-key-wrong-key', timeoutMs: 5_000 });
    expect((await wrong.verify('998000001')).result).toBe('pending');
  });
});

describe('NIDA through GTBank, sandbox', () => {
  const registry = (): GtbankNidaRegistry =>
    new GtbankNidaRegistry({
      mode: 'sandbox',
      baseUrl: `${base}/gtbank`,
      clientId: credentials.gtbank.clientId,
      clientSecret: credentials.gtbank.clientSecret,
      timeoutMs: 5_000,
    });

  it('verifies a citizen against their own selfie', async () => {
    const selfie = await image('/__mock/documents/citizens/1198870034567812/selfie.png');
    const check = await registry().verify({ documentNumber: '1198870034567812', selfie, reference: 'spec-1' });
    expect(check).toMatchObject({
      status: 'verified',
      face: 'match',
      generated: true,
      holder: { fullName: 'Aline Uwase', dateOfBirth: '1988-07-21', gender: 'female', issuingCountry: 'RW' },
    });
  });

  it("refuses another person's selfie and an unknown number; a gateway without biometrics is not checked", async () => {
    const aline = await image('/__mock/documents/citizens/1198870034567812/selfie.png');
    expect(await registry().verify({ documentNumber: '1198580045678923', selfie: aline, reference: 'spec-2' })).toEqual({
      status: 'rejected',
      reason: 'face_mismatch',
    });
    expect(await registry().verify({ documentNumber: '1199080000000012', selfie: aline, reference: 'spec-3' })).toEqual({
      status: 'rejected',
      reason: 'not_found',
    });
    expect(await registry().verify({ documentNumber: '1198770066789045', selfie: aline, reference: 'spec-4' })).toEqual({
      status: 'rejected',
      reason: 'revoked',
    });
    const clarisse = await registry().verify({ documentNumber: '1199170088901267', selfie: aline, reference: 'spec-5' });
    expect(clarisse).toMatchObject({ status: 'verified', face: 'not_checked' });
  });

  it('reads an outage as unavailable', async () => {
    const selfie = await image('/__mock/documents/citizens/1198870034567812/selfie.png');
    expect(await registry().verify({ documentNumber: '1199089999999012', selfie, reference: 'spec-6' })).toEqual({
      status: 'unavailable',
    });
  });
});

describe('Smile ID, sandbox', () => {
  const verifier = (): SmileIdDocumentVerifier =>
    new SmileIdDocumentVerifier({
      mode: 'sandbox',
      baseUrl: `${base}/smile-id`,
      partnerId: credentials.smileId.partnerId,
      apiKey: credentials.smileId.apiKey,
      timeoutMs: 5_000,
      pollTimeoutMs: 5_000,
      pollIntervalMs: 50,
    });

  it('verifies a passport against its holder', async () => {
    const check = await verifier().verifyDocument({
      documentType: 'passport',
      front: await image('/__mock/documents/passports/P10000001/photo-page.png'),
      selfie: await image('/__mock/documents/passports/P10000001/selfie.png'),
      issuingCountry: 'KE',
    });
    expect(check).toMatchObject({
      status: 'verified',
      holder: { fullName: 'Sarah Wanjiku', documentNumber: 'P10000001', issuingCountry: 'KE', expiresOn: '2031-05-01' },
    });
  });

  it('refuses an expired passport, a forgery and a stranger’s selfie', async () => {
    const run = async (passport: string, selfieOf: string): Promise<DocumentCheck> =>
      verifier().verifyDocument({
        documentType: 'passport',
        front: await image(`/__mock/documents/passports/${passport}/photo-page.png`),
        selfie: await image(`/__mock/documents/passports/${selfieOf}/selfie.png`),
      });
    expect(await run('P10000002', 'P10000002')).toEqual({ status: 'rejected', reason: 'expired' });
    expect(await run('P10000003', 'P10000003')).toEqual({ status: 'rejected', reason: 'not_authentic' });
    expect(await run('P10000001', 'P10000005')).toEqual({ status: 'rejected', reason: 'face_mismatch' });
  });
});

describe('GTBank Payment Hub, sandbox', () => {
  const adapter = (): GtbankPaymentAdapter =>
    new GtbankPaymentAdapter({
      mode: 'sandbox',
      baseUrl: `${base}/gtbank`,
      clientId: credentials.gtbank.clientId,
      clientSecret: credentials.gtbank.clientSecret,
      webhookSecret: credentials.gtbank.webhookSecret,
      timeoutMs: 5_000,
    });
  const fee = (key: string, msisdn: string): OneTimeFeeCommand => ({
    kind: 'one_time_fee',
    purpose: 'registration_fee',
    feeCode: 'registration_fee',
    idempotencyKey: `ws-spec:registration-fee:${key}`,
    amountRwf: 50_000,
    currency: 'RWF',
    workspaceId: 'ws-spec',
    instrument: { kind: 'mobile_money', network: 'mtn_momo', msisdn },
  });
  const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  it('prompts, answers a replay with the same transaction, then settles when the handset approves', async () => {
    const port = adapter();
    const first = await port.chargeOneTimeFee(fee('a', '788300412'));
    expect(first).toMatchObject({ settlement: 'pending', mode: 'mock', amountRwf: 50_000 });
    const again = await port.chargeOneTimeFee(fee('a', '788300412'));
    expect(again.adapterRef).toBe(first.adapterRef);
    await wait(500);
    expect((await port.fetchTransaction('ws-spec', first.adapterRef))?.settlement).toBe('settled');
    // Another workspace's reference is no transaction to this one.
    expect(await port.fetchTransaction('ws-other', first.adapterRef)).toBeNull();
  });

  it('reads a prompt the payer declined as ended unpaid', async () => {
    const port = adapter();
    const prompt = await port.chargeOneTimeFee(fee('b', '788300523'));
    await fetch(`${base}/__mock/transactions/${prompt.adapterRef}/decline`, { method: 'POST' });
    const read = await port.fetchTransaction('ws-spec', prompt.adapterRef);
    expect(read?.settlement).toBe('pending');
    expect(read?.failure).toMatchObject({ status: 'rejected', reason: 'the payer declined the request on their phone' });
  });

  it('refuses a card before sending anything', async () => {
    await expect(
      adapter().chargeOneTimeFee({ ...fee('c', '788300412'), instrument: { kind: 'card' } as never }),
    ).rejects.toMatchObject({ name: 'PaymentUnavailableError', delivered: 'no' });
  });
});
