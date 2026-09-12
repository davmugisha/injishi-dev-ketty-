import { randomBytes } from 'node:crypto';

import type { EbmLive } from '../domain/ebm-live';
import { EbmApiClient, EbmApiError } from '../infrastructure/ebm-api.client';
import type {
  EbmConnectionRepository,
  EbmConnectionRow,
} from '../infrastructure/ebm-connection.repository';
import { TokenCipher } from '../infrastructure/token-cipher';
import {
  EbmConnectionService,
  connectReturnUrl,
  notReadyReason,
  sha256Base64url,
} from './ebm-connection.service';

/**
 * The consent flow is where a business's sales get pointed at a tax identity,
 * so what is pinned here is who may complete it and whose account it may be:
 * the person who started it, before it expires, once, and only an account
 * carrying the business's own TIN.
 */
describe('EbmConnectionService', () => {
  const ORG = '44444444-4444-4444-4444-444444444444';
  const OWNER = '11111111-1111-1111-1111-111111111111';
  const OTHER = '22222222-2222-2222-2222-222222222222';
  const NOW = new Date('2026-09-11T10:00:00.000Z');
  const RETURN = 'http://localhost:3002/settings/ebm';

  const cipher = new TokenCipher(randomBytes(32));

  class FixedClock extends EbmConnectionService {
    protected override now(): Date {
      return NOW;
    }
  }

  interface StoredState {
    stateHash: string;
    codeVerifierCiphertext: string;
    orgId: string;
    userId: string;
    expiresAt: Date;
    consumedAt: Date | null;
  }

  interface Harness {
    service: EbmConnectionService;
    repo: Record<string, jest.Mock>;
    client: Record<string, jest.Mock>;
    states: StoredState[];
    saved: Array<Parameters<EbmConnectionRepository['saveConnected']>[0]>;
  }

  function harness(opts: {
    orgTin?: string | null;
    accountTin?: string;
    accountStatus?: string;
    connection?: Partial<EbmConnectionRow> | null;
    environment?: 'production' | 'demo';
  } = {}): Harness {
    const states: StoredState[] = [];
    let connection: EbmConnectionRow | null = opts.connection
      ? ({
          orgId: ORG,
          status: 'connected',
          tin: '102938475',
          accountStatus: 'approved',
          accommodationItemId: null,
          serviceFeeItemId: null,
          walkInCustomerId: null,
          scopes: [],
          connectedAt: NOW,
          accessTokenCiphertext: cipher.encrypt('at-old', `ebm:access:${ORG}`),
          refreshTokenCiphertext: cipher.encrypt('rt-old', `ebm:refresh:${ORG}`),
          accessTokenExpiresAt: new Date(NOW.getTime() + 3_600_000),
          ...opts.connection,
        } as EbmConnectionRow)
      : null;
    const saved: Array<Parameters<EbmConnectionRepository['saveConnected']>[0]> = [];

    const repo = {
      orgIdentity: jest.fn(async () =>
        opts.orgTin === null ? { tin: null, legalName: 'X' } : { tin: opts.orgTin ?? '102938475', legalName: 'Umurage Ltd' },
      ),
      saveState: jest.fn(async (input: Omit<StoredState, 'consumedAt'>) => {
        states.push({ ...input, consumedAt: null });
      }),
      consumeState: jest.fn(async (hash: string, now: Date) => {
        const row = states.find(
          (s) => s.stateHash === hash && s.consumedAt === null && s.expiresAt > now,
        );
        if (!row) return null;
        row.consumedAt = now;
        return { orgId: row.orgId, userId: row.userId, codeVerifierCiphertext: row.codeVerifierCiphertext };
      }),
      saveConnected: jest.fn(async (input: Parameters<EbmConnectionRepository['saveConnected']>[0]) => {
        saved.push(input);
      }),
      findByOrg: jest.fn(async () => connection),
      businessWorkspaceOf: jest.fn(async () => 'ws-1'),
      heldSaleCount: jest.fn(async () => 0),
      rearmHeld: jest.fn(async () => 0),
      saveTokens: jest.fn(async () => undefined),
      revoke: jest.fn(async () => {
        if (connection) connection = { ...connection, status: 'revoked' };
      }),
      saveMapping: jest.fn(async () => true),
      saveAccountStatus: jest.fn(async () => undefined),
    };

    const client = {
      authorizeUrl: jest.fn((input: { state: string; codeChallenge: string }) =>
        new EbmApiClient({
          baseUrl: 'https://ebm.test',
          clientId: 'c',
          clientSecret: 's',
          redirectUri: 'http://localhost:8000/api/v1/ebm/oauth/callback',
          timeoutMs: 1000,
        }).authorizeUrl(input),
      ),
      exchangeCode: jest.fn(async () => ({
        accessToken: 'at-new',
        refreshToken: 'rt-new',
        expiresAt: new Date(NOW.getTime() + 3_600_000),
        scopes: ['ebm:read', 'invoices:create'],
      })),
      account: jest.fn(async () => ({
        name: 'Umurage Ltd',
        tin: opts.accountTin ?? '102938475',
        branchId: '00',
        status: opts.accountStatus ?? 'approved',
        vatRegistered: true,
      })),
      revoke: jest.fn(async () => undefined),
      refresh: jest.fn(),
      items: jest.fn(),
      customers: jest.fn(),
    };

    const live = {
      config: {
        api: {} as EbmLive['config']['api'],
        cipher,
        connectReturnUrl: RETURN,
        liveSince: NOW,
      },
      client: client as unknown as EbmApiClient,
    } satisfies EbmLive;

    const service = new FixedClock(repo as unknown as EbmConnectionRepository, live, {
      environment: opts.environment ?? 'production',
      sampleData: false,
    });
    return { service, repo, client, states, saved };
  }

  /** Start a consent and pull the state back out of the URL, as the browser would. */
  async function startedBy(h: Harness, userId = OWNER): Promise<{ url: URL; state: string }> {
    const { authorizeUrl } = await h.service.start(ORG, userId);
    const url = new URL(authorizeUrl);
    return { url, state: url.searchParams.get('state')! };
  }

  // -------------------------------------------------------------------------

  it('builds an authorize url with an S256 code challenge', async () => {
    const h = harness();
    const { url, state } = await startedBy(h);

    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    const stored = h.states[0];
    // The state is stored hashed, never as the value that rode the URL.
    expect(stored.stateHash).toBe(sha256Base64url(state));
    expect(stored.stateHash).not.toBe(state);
    // The challenge is SHA-256 of the stored (encrypted) verifier.
    const verifier = cipher.decrypt(stored.codeVerifierCiphertext, `ebm:pkce:${ORG}`);
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(url.searchParams.get('code_challenge')).toBe(sha256Base64url(verifier));
    expect(stored.expiresAt.getTime() - NOW.getTime()).toBe(10 * 60_000);
  });

  it("returns to the consenting business's own workspace when the return url is a template", () => {
    const template = 'http://localhost:3002/w/{workspaceId}/settings/integrations';
    expect(connectReturnUrl(template, 'ws-1').toString()).toBe(
      'http://localhost:3002/w/ws-1/settings/integrations',
    );
    // Before the state is redeemed no workspace is known: the front door.
    expect(connectReturnUrl(template, null).toString()).toBe('http://localhost:3002/');
    // A fixed url is used as it is.
    expect(connectReturnUrl(RETURN, 'ws-1').toString()).toBe(RETURN);
  });

  it('refuses to start for a business with no TIN on record', async () => {
    const h = harness({ orgTin: null });
    await expect(h.service.start(ORG, OWNER)).rejects.toThrow(/no TIN/);
    expect(h.states).toHaveLength(0);
  });

  it('connects the account and stores the tokens encrypted', async () => {
    const h = harness();
    const { state } = await startedBy(h);
    const target = await h.service.complete({ code: 'code-1', state }, OWNER);

    expect(target).toBe(`${RETURN}?ebm=connected`);
    const verifier = cipher.decrypt(h.states[0].codeVerifierCiphertext, `ebm:pkce:${ORG}`);
    expect(h.client.exchangeCode).toHaveBeenCalledWith({ code: 'code-1', codeVerifier: verifier });
    expect(h.saved).toHaveLength(1);
  });

  it('stores the tokens encrypted', async () => {
    const h = harness();
    const { state } = await startedBy(h);
    await h.service.complete({ code: 'code-1', state }, OWNER);

    const { tokens } = h.saved[0];
    expect(tokens.accessTokenCiphertext).not.toContain('at-new');
    expect(tokens.refreshTokenCiphertext).not.toContain('rt-new');
    expect(cipher.decrypt(tokens.accessTokenCiphertext, `ebm:access:${ORG}`)).toBe('at-new');
    expect(cipher.decrypt(tokens.refreshTokenCiphertext!, `ebm:refresh:${ORG}`)).toBe('rt-new');
    // Bound to this org: the same ciphertext does not open as another org's.
    expect(() => cipher.decrypt(tokens.accessTokenCiphertext, 'ebm:access:another-org')).toThrow();
  });

  it('refuses a state that belongs to another user', async () => {
    const h = harness();
    const { state } = await startedBy(h, OWNER);
    const target = await h.service.complete({ code: 'code-1', state }, OTHER);

    expect(target).toBe(`${RETURN}?ebm=error&reason=wrong_user`);
    expect(h.client.exchangeCode).not.toHaveBeenCalled();
    expect(h.saved).toHaveLength(0);
    // Spent anyway, so it cannot then be replayed by the right user.
    expect(await h.service.complete({ code: 'code-1', state }, OWNER)).toContain('reason=expired');
  });

  it('refuses an expired state', async () => {
    const h = harness();
    const { state } = await startedBy(h);
    h.states[0].expiresAt = new Date(NOW.getTime() - 1);
    expect(await h.service.complete({ code: 'code-1', state }, OWNER)).toBe(
      `${RETURN}?ebm=error&reason=expired`,
    );
    expect(h.client.exchangeCode).not.toHaveBeenCalled();
  });

  it('refuses a state used twice', async () => {
    const h = harness();
    const { state } = await startedBy(h);
    await h.service.complete({ code: 'code-1', state }, OWNER);
    expect(await h.service.complete({ code: 'code-1', state }, OWNER)).toContain('reason=expired');
    expect(h.client.exchangeCode).toHaveBeenCalledTimes(1);
  });

  it("refuses an EBM account whose TIN is not the org's", async () => {
    const h = harness({ orgTin: '102938475', accountTin: '999888777' });
    const { state } = await startedBy(h);
    const target = await h.service.complete({ code: 'code-1', state }, OWNER);

    expect(target).toBe(`${RETURN}?ebm=error&reason=tin_mismatch`);
    expect(h.saved).toHaveLength(0);
    // The token does not outlive the refusal.
    expect(h.client.revoke).toHaveBeenCalledWith('rt-new');
  });

  it('matches TINs by their digits', async () => {
    const h = harness({ orgTin: '102 938 475', accountTin: '102938475' });
    const { state } = await startedBy(h);
    expect(await h.service.complete({ code: 'code-1', state }, OWNER)).toContain('ebm=connected');
  });

  it('refuses a disabled EBM account', async () => {
    const h = harness({ accountStatus: 'disabled' });
    const { state } = await startedBy(h);
    expect(await h.service.complete({ code: 'code-1', state }, OWNER)).toContain(
      'reason=account_disabled',
    );
    expect(h.saved).toHaveLength(0);
  });

  it('sends the taxpayer back with "denied" when they declined consent', async () => {
    const h = harness();
    const { state } = await startedBy(h);
    expect(await h.service.complete({ state, error: 'access_denied' }, OWNER)).toContain(
      'reason=denied',
    );
  });

  it('renews a token that is about to expire, and keeps the refresh token when none is reissued', async () => {
    const h = harness({
      connection: {
        accessTokenExpiresAt: new Date(NOW.getTime() + 30_000),
        accommodationItemId: 3,
        serviceFeeItemId: 4,
        walkInCustomerId: 7,
      },
    });
    h.client.refresh.mockResolvedValue({
      accessToken: 'at-renewed',
      refreshToken: null,
      expiresAt: new Date(NOW.getTime() + 3_600_000),
      scopes: [],
    });
    const creds = await h.service.credentialsFor(ORG);

    expect(creds).toMatchObject({ ready: true, accessToken: 'at-renewed' });
    const sealed = h.repo.saveTokens.mock.calls[0] as unknown as [string, { refreshTokenCiphertext: string }];
    expect(cipher.decrypt(sealed[1].refreshTokenCiphertext, `ebm:refresh:${ORG}`)).toBe('rt-old');
  });

  it('revokes a connection whose refresh the provider refuses', async () => {
    const h = harness({
      connection: {
        accessTokenExpiresAt: new Date(NOW.getTime() - 1),
        accommodationItemId: 3,
        serviceFeeItemId: 4,
        walkInCustomerId: 7,
      },
    });
    h.client.refresh.mockRejectedValue(new EbmApiError('rejected', 400, 'invalid_grant'));
    const creds = await h.service.credentialsFor(ORG);

    expect(creds.ready).toBe(false);
    expect(h.repo.revoke).toHaveBeenCalled();
  });

  it('passes a provider outage during refresh up as retryable, without revoking', async () => {
    const h = harness({
      connection: {
        accessTokenExpiresAt: new Date(NOW.getTime() - 1),
        accommodationItemId: 3,
        serviceFeeItemId: 4,
        walkInCustomerId: 7,
      },
    });
    h.client.refresh.mockRejectedValue(new EbmApiError('unavailable', null, 'down'));
    await expect(h.service.credentialsFor(ORG)).rejects.toMatchObject({ kind: 'unavailable' });
    expect(h.repo.revoke).not.toHaveBeenCalled();
  });

  it('is not ready until the account is approved and all three items are mapped', () => {
    const base = {
      status: 'connected',
      accountStatus: 'approved',
      accommodationItemId: 3,
      serviceFeeItemId: 4,
      walkInCustomerId: 7,
    } as EbmConnectionRow;
    expect(notReadyReason(base)).toBeNull();
    expect(notReadyReason({ ...base, accountStatus: 'submitted' })).toMatch(/waiting for RRA approval/);
    expect(notReadyReason({ ...base, status: 'revoked' })).toMatch(/withdrawn/);
    expect(notReadyReason({ ...base, accommodationItemId: null })).toMatch(/room night/);
    expect(notReadyReason({ ...base, serviceFeeItemId: null })).toMatch(/service fee/);
    expect(notReadyReason({ ...base, walkInCustomerId: null })).toMatch(/walk-in customer/);
  });

  it('refuses every action in mock mode rather than pretending to connect', async () => {
    const service = new FixedClock({} as EbmConnectionRepository, null, {
      environment: 'production',
      sampleData: false,
    });
    await expect(service.start(ORG, OWNER)).rejects.toThrow(/mock mode/);
    expect(await service.credentialsFor(ORG)).toEqual({ ready: false, reason: 'RRA invoicing is in mock mode' });
  });

  it('never connects or certifies from the demo environment, even in live mode', async () => {
    const h = harness({
      environment: 'demo',
      connection: { accommodationItemId: 3, serviceFeeItemId: 4, walkInCustomerId: 7 },
    });
    await expect(h.service.start(ORG, OWNER)).rejects.toThrow(/demo environment/);
    expect(h.states).toHaveLength(0);
    expect((await h.service.credentialsFor(ORG)).ready).toBe(false);
  });
});
