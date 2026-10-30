import { describe, expect, it } from 'vitest';

import {
  EBM_SCOPES,
  EbmApiClient,
  EbmApiError,
  type EbmApiConfig,
} from './ebm-api.client';

/**
 * The client is judged on two things: that it sends what the provider's v1
 * contract documents, and that every way a call can fail lands in the right
 * bucket. The second matters more than the first — the invoice POST has no
 * idempotency key, so a failure put in the "safe to retry" bucket by mistake is
 * a stay declared to RRA twice.
 */
describe('EbmApiClient', () => {
  const config: EbmApiConfig = {
    baseUrl: 'https://ebm.test/',
    clientId: 'client-1',
    clientSecret: 'shh-client-secret',
    redirectUri: 'http://localhost:8000/api/v1/ebm/oauth/callback',
    timeoutMs: 5_000,
  };
  const NOW = new Date('2026-09-11T10:00:00.000Z');

  interface Call {
    url: string;
    init: RequestInit;
  }

  function clientAnswering(
    respond: (call: Call) => Response | Promise<Response>,
  ): { client: EbmApiClient; calls: Call[] } {
    const calls: Call[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      const call = { url, init };
      calls.push(call);
      return respond(call);
    }) as unknown as typeof fetch;
    return { client: new EbmApiClient(config, fetchImpl, () => NOW), calls };
  }

  function clientFailingWith(error: unknown): EbmApiClient {
    const fetchImpl = (async () => {
      throw error;
    }) as unknown as typeof fetch;
    return new EbmApiClient(config, fetchImpl, () => NOW);
  }

  const json = (status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  const INVOICE = {
    customerId: 7,
    paymentMethod: '07',
    items: [{ id: 3, quantity: 2, unitPrice: 90_000 }],
  };

  async function failureOf(promise: Promise<unknown>): Promise<EbmApiError> {
    try {
      await promise;
    } catch (error) {
      if (error instanceof EbmApiError) return error;
      throw error;
    }
    throw new Error('expected the call to fail');
  }

  // -------------------------------------------------------------------------

  it('builds an authorize url with PKCE S256, the registered redirect and only the scopes it uses', () => {
    const { client } = clientAnswering(() => json(200, {}));
    const url = new URL(
      client.authorizeUrl({ state: 'st-1', codeChallenge: 'chal-1' }),
    );
    expect(url.origin + url.pathname).toBe('https://ebm.test/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('client-1');
    expect(url.searchParams.get('redirect_uri')).toBe(config.redirectUri);
    expect(url.searchParams.get('code_challenge')).toBe('chal-1');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toBe('st-1');
    expect(url.searchParams.get('scope')).toBe(EBM_SCOPES.join(' '));
    expect(url.searchParams.get('scope')).not.toContain('invoices:refund');
    // The client secret is a server credential; it never rides a browser URL.
    expect(url.toString()).not.toContain('shh-client-secret');
  });

  it('exchanges a code as a form post and computes the token expiry', async () => {
    const { client, calls } = clientAnswering(() =>
      json(200, {
        access_token: 'at-1',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'rt-1',
        scope: 'ebm:read invoices:create',
      }),
    );
    const tokens = await client.exchangeCode({ code: 'c-1', codeVerifier: 'v-1' });

    expect(calls[0].url).toBe('https://ebm.test/oauth/token');
    expect((calls[0].init.headers as Record<string, string>)['content-type']).toBe(
      'application/x-www-form-urlencoded',
    );
    const form = new URLSearchParams(String(calls[0].init.body));
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(form.get('code')).toBe('c-1');
    expect(form.get('code_verifier')).toBe('v-1');
    expect(form.get('redirect_uri')).toBe(config.redirectUri);
    expect(tokens).toEqual({
      accessToken: 'at-1',
      refreshToken: 'rt-1',
      expiresAt: new Date('2026-09-11T11:00:00.000Z'),
      scopes: ['ebm:read', 'invoices:create'],
    });
  });

  it('assumes a short life for a token that states none', async () => {
    const { client } = clientAnswering(() => json(200, { access_token: 'at-1' }));
    const tokens = await client.refresh('rt-1');
    expect(tokens.expiresAt.getTime() - NOW.getTime()).toBe(300_000);
    expect(tokens.refreshToken).toBeNull();
  });

  it('posts the invoice with a bearer token and a JSON body', async () => {
    const { client, calls } = clientAnswering(() =>
      json(200, { id: 41, invcNo: 12, rcptNo: 5, status: 'Certified', totAmt: 180000 }),
    );
    const invoice = await client.createInvoice('at-1', INVOICE);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://ebm.test/api/v1/invoices');
    expect(calls[0].init.method).toBe('POST');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer at-1');
    expect(headers['content-type']).toBe('application/json');
    expect(JSON.parse(String(calls[0].init.body))).toEqual(INVOICE);
    expect(invoice.id).toBe(41);
    expect(invoice.status).toBe('Certified');
    // Kept whole: the stored record is what the Authority answered.
    expect(invoice.raw).toMatchObject({ invcNo: 12, rcptNo: 5, totAmt: 180000 });
  });

  it('reads an invoice from the { data } envelope the GET uses', async () => {
    const { client } = clientAnswering(() =>
      json(200, { data: { id: 41, status: 'Certified', rcptNo: 5 } }),
    );
    const invoice = await client.invoice('at-1', 41);
    expect(invoice.id).toBe(41);
    expect(invoice.raw.rcptNo).toBe(5);
  });

  it('classifies a 400 as rejected', async () => {
    const { client } = clientAnswering(() =>
      json(400, { error: 'Item 3 not found' }),
    );
    const failure = await failureOf(client.createInvoice('at-1', INVOICE));
    expect(failure.kind).toBe('rejected');
    expect(failure.status).toBe(400);
    expect(failure.message).toContain('Item 3 not found');
  });

  it('classifies a 401 as unauthorized', async () => {
    const { client } = clientAnswering(() =>
      json(401, { error: 'invalid_token', error_description: 'expired' }),
    );
    const failure = await failureOf(client.createInvoice('at-1', INVOICE));
    expect(failure.kind).toBe('unauthorized');
    expect(failure.message).not.toContain('at-1');
  });

  it('classifies a 502 as unavailable', async () => {
    const { client } = clientAnswering(() =>
      json(502, { error: 'VSDC is unreachable' }),
    );
    expect((await failureOf(client.createInvoice('at-1', INVOICE))).kind).toBe(
      'unavailable',
    );
  });

  it('classifies a 500 or a 504 on the invoice as an unknown outcome, and on a read as unavailable', async () => {
    for (const status of [500, 504]) {
      const { client } = clientAnswering(() => json(status, { error: 'boom' }));
      expect((await failureOf(client.createInvoice('at-1', INVOICE))).kind).toBe(
        'unknown_outcome',
      );
      expect((await failureOf(client.account('at-1'))).kind).toBe('unavailable');
    }
  });

  it('classifies a timeout as an unknown outcome', async () => {
    const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    const failure = await failureOf(
      clientFailingWith(timeout).createInvoice('at-1', INVOICE),
    );
    expect(failure.kind).toBe('unknown_outcome');
    expect(failure.status).toBeNull();
  });

  it('classifies a refused connection as unavailable, because nothing was sent', async () => {
    const refused = Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }),
    });
    expect(
      (await failureOf(clientFailingWith(refused).createInvoice('at-1', INVOICE))).kind,
    ).toBe('unavailable');
  });

  it('classifies a connection reset mid-request as an unknown outcome', async () => {
    const reset = Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }),
    });
    expect(
      (await failureOf(clientFailingWith(reset).createInvoice('at-1', INVOICE))).kind,
    ).toBe('unknown_outcome');
  });

  it('treats a 200 with no invoice id as an unknown outcome, not a success', async () => {
    const { client } = clientAnswering(() => json(200, { success: true }));
    expect((await failureOf(client.createInvoice('at-1', INVOICE))).kind).toBe(
      'unknown_outcome',
    );
  });

  it('treats a 200 whose body is not JSON as an unknown outcome on the invoice', async () => {
    const { client } = clientAnswering(
      () => new Response('<html>gateway</html>', { status: 200 }),
    );
    expect((await failureOf(client.createInvoice('at-1', INVOICE))).kind).toBe(
      'unknown_outcome',
    );
  });

  it('reads the account the token belongs to', async () => {
    const { client } = clientAnswering(() =>
      json(200, {
        data: { id: 1, name: 'Umurage Ltd', tin: ' 102938475 ', bhfId: '00', status: 'approved', vatRegistered: true },
      }),
    );
    expect(await client.account('at-1')).toEqual({
      name: 'Umurage Ltd',
      tin: '102938475',
      branchId: '00',
      status: 'approved',
      vatRegistered: true,
    });
  });

  it('refuses an account answer that carries no TIN', async () => {
    const { client } = clientAnswering(() => json(200, { data: { name: 'x' } }));
    expect((await failureOf(client.account('at-1'))).kind).toBe('rejected');
  });

  it('lists catalog items with the search forwarded', async () => {
    const { client, calls } = clientAnswering(() =>
      json(200, {
        data: [{ id: 3, itemCd: 'RW1NTXU0000001', itemNm: 'Room night', taxTyCd: 'B', unitPrice: 90000 }],
        meta: { total: 1, page: 1, limit: 100 },
      }),
    );
    const result = await client.items('at-1', { search: 'room' });
    expect(calls[0].url).toBe('https://ebm.test/api/v1/items?search=room');
    expect(result).toEqual({
      items: [{ id: 3, itemCd: 'RW1NTXU0000001', itemNm: 'Room night', taxTyCd: 'B', unitPrice: 90000 }],
      total: 1,
    });
  });
});
