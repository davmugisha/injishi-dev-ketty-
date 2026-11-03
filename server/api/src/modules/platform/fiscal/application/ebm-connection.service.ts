import type {
  EbmAccountStatus,
  EbmCatalogItem,
  EbmConnection,
  EbmCustomerOption,
  EbmItemMapping,
  EbmItemMappingInput,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

import { PLATFORM, type Platform } from '../../../../shared/config/platform';
import { EBM_LIVE, type EbmLive } from '../domain/ebm-live';
import {
  EbmApiError,
  type EbmApiClient,
  type EbmCustomer,
  type EbmItem,
  type EbmTokenSet,
} from '../infrastructure/ebm-api.client';
import {
  EbmConnectionRepository,
  type EbmConnectionRow,
  type SealedTokens,
} from '../infrastructure/ebm-connection.repository';

/** How long a taxpayer has to finish the consent screen. */
const STATE_TTL_MS = 10 * 60_000;
/** Refresh a token this close to expiry rather than send it and get a 401. */
const REFRESH_MARGIN_MS = 60_000;
/** How far the mapping check pages through a catalog looking for an id. */
const MAX_CATALOG_PAGES = 20;
const CATALOG_PAGE = 100;

/**
 * Only this provider state may certify a sale. Named once, here, because the
 * setup screen's "ready" and the worker's "may I send" must be the same test.
 */
const APPROVED = 'approved';

/**
 * Why the callback bounced the taxpayer back to the operator app. A short code
 * rather than prose, because it rides a URL and the screen owns the wording.
 */
export type ConnectFailure =
  | 'denied'
  | 'expired'
  | 'wrong_user'
  | 'tin_mismatch'
  | 'no_tin'
  | 'account_disabled'
  | 'provider_error';

/** What the emission worker gets back when it asks whether it may send. */
export type Credentials =
  | { ready: false; reason: string }
  | {
      ready: true;
      accessToken: string;
      tin: string;
      mapping: EbmItemMapping;
    };

function base64url(bytes: Buffer): string {
  return bytes.toString('base64url');
}

export function sha256Base64url(value: string): string {
  return base64url(createHash('sha256').update(value).digest());
}

/** TINs compare as their digits: `102 938 475` and `102938475` are one taxpayer. */
function sameTin(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (v: string | null | undefined): string => (v ?? '').replace(/\D/g, '');
  return norm(a).length > 0 && norm(a) === norm(b);
}

function toAccountStatus(value: string | null): EbmAccountStatus | null {
  return value === 'submitted' || value === 'approved' || value === 'disabled'
    ? value
    : null;
}

/**
 * A business's link to its own RRA EBM account (ADR-041).
 *
 * The flow is OAuth 2.0 Authorization Code with PKCE, the only one the provider
 * offers integrators:
 *
 * 1. `start` — an owner or manager asks to connect. A random `state` and PKCE
 *    verifier are made; the state's HASH and the verifier's CIPHERTEXT are
 *    stored against the org and the person; the browser is sent to the
 *    provider's consent screen.
 * 2. `complete` — the provider sends the browser back with a code. The state is
 *    consumed (once, unexpired, by the SAME person who started it), the code is
 *    redeemed with the verifier, and the account the token belongs to is read.
 *    Its TIN must be the org's TIN, or nothing is saved: a connection is a
 *    statement that this business's sales are declared under THAT account, and
 *    connecting somebody else's account would declare them under somebody
 *    else's tax identity.
 *
 * Tokens are sealed with `TokenCipher` before they reach the repository and are
 * opened only in `credentialsFor`, immediately before the worker uses them.
 */
@Injectable()
export class EbmConnectionService {
  private readonly log = new Logger(EbmConnectionService.name);

  constructor(
    private readonly connections: EbmConnectionRepository,
    @Inject(EBM_LIVE) private readonly live: EbmLive | null,
    @Inject(PLATFORM)
    private readonly platform: Platform,
  ) {}

  /** The clock. A method rather than a constructor argument so DI stays clean; specs override it. */
  protected now(): Date {
    return new Date();
  }

  private requireLive(): EbmLive {
    // The demo's businesses are fictional. Connecting one to a real EBM
    // account would put a real taxpayer's credential behind a play booking.
    if (this.platform.environment === 'demo') {
      throw new ConflictException(
        'The demo environment cannot connect an RRA EBM account.',
      );
    }
    if (!this.live) {
      throw new ConflictException(
        'RRA invoicing is running in mock mode on this deployment, so there is no EBM account to connect.',
      );
    }
    return this.live;
  }

  private accessContext(orgId: string): string {
    return `ebm:access:${orgId}`;
  }

  private refreshContext(orgId: string): string {
    return `ebm:refresh:${orgId}`;
  }

  // -------------------------------------------------------------------------
  // Consent
  // -------------------------------------------------------------------------

  async start(orgId: string, userId: string): Promise<{ authorizeUrl: string }> {
    const live = this.requireLive();
    const org = await this.connections.orgIdentity(orgId);
    if (!org?.tin) {
      // Refused before the taxpayer is sent anywhere: without a TIN on record
      // there is nothing to check the EBM account against, and every consent
      // would end in a mismatch the person could not fix from that screen.
      throw new ConflictException(
        'This business has no TIN on record, so it cannot be matched to an EBM account.',
      );
    }

    const state = base64url(randomBytes(32));
    // 64 random bytes → 86 base64url characters, inside RFC 7636's 43..128.
    const verifier = base64url(randomBytes(64));
    const now = this.now();

    await this.connections.saveState({
      stateHash: sha256Base64url(state),
      codeVerifierCiphertext: live.config.cipher.encrypt(verifier, `ebm:pkce:${orgId}`),
      orgId,
      userId,
      expiresAt: new Date(now.getTime() + STATE_TTL_MS),
    });

    return {
      authorizeUrl: live.client.authorizeUrl({
        state,
        codeChallenge: sha256Base64url(verifier),
      }),
    };
  }

  /**
   * Finish the consent and answer where to send the browser. Never throws for a
   * taxpayer-facing failure: the person is mid-redirect, and a JSON error page
   * is a dead end. Every outcome is a redirect to the operator app carrying a
   * code the screen turns into words.
   */
  async complete(
    input: { code?: string; state?: string; error?: string },
    userId: string,
  ): Promise<string> {
    const live = this.requireLive();
    // Unknown until the state is redeemed: which business this consent was
    // for, and so which workspace's settings screen to return to.
    let workspaceId: string | null = null;
    const back = (outcome: 'connected' | ConnectFailure): string => {
      const url = connectReturnUrl(live.config.connectReturnUrl, workspaceId);
      if (outcome === 'connected') url.searchParams.set('ebm', 'connected');
      else {
        url.searchParams.set('ebm', 'error');
        url.searchParams.set('reason', outcome);
      }
      return url.toString();
    };

    if (!input.state) return back('expired');
    const taken = await this.connections.consumeState(
      sha256Base64url(input.state),
      this.now(),
    );
    if (!taken) return back('expired');
    workspaceId = await this.connections.businessWorkspaceOf(taken.orgId);

    // CSRF, the case the state exists for: someone starts a consent with THEIR
    // account and lures a signed-in owner to the callback. The state is spent
    // either way, so it cannot be replayed at the right user afterwards.
    if (taken.userId !== userId) {
      this.log.warn(`EBM consent for org ${taken.orgId} completed by a different user; refused`);
      return back('wrong_user');
    }
    if (input.error || !input.code) return back('denied');

    let verifier: string;
    try {
      verifier = live.config.cipher.decrypt(
        taken.codeVerifierCiphertext,
        `ebm:pkce:${taken.orgId}`,
      );
    } catch (error) {
      this.log.error(`EBM consent for org ${taken.orgId}: ${String(error)}`);
      return back('provider_error');
    }

    let tokens: EbmTokenSet;
    let account;
    try {
      tokens = await live.client.exchangeCode({ code: input.code, codeVerifier: verifier });
      account = await live.client.account(tokens.accessToken);
    } catch (error) {
      this.log.warn(`EBM consent for org ${taken.orgId} failed at the provider: ${String(error)}`);
      return back('provider_error');
    }

    const org = await this.connections.orgIdentity(taken.orgId);
    if (!org?.tin) return back('no_tin');
    if (!sameTin(account.tin, org.tin)) {
      // Nothing is stored, and the token is handed back to the provider so it
      // does not outlive the refusal.
      this.log.warn(
        `EBM consent for org ${taken.orgId} refused: account TIN ${account.tin} is not the org's TIN`,
      );
      await this.revokeQuietly(tokens.refreshToken ?? tokens.accessToken);
      return back('tin_mismatch');
    }
    if (account.status === 'disabled') {
      await this.revokeQuietly(tokens.refreshToken ?? tokens.accessToken);
      return back('account_disabled');
    }

    await this.connections.saveConnected({
      orgId: taken.orgId,
      account: {
        tin: account.tin,
        accountName: account.name,
        accountStatus: account.status,
        branchId: account.branchId,
        vatRegistered: account.vatRegistered,
        scopes: tokens.scopes,
      },
      tokens: this.seal(taken.orgId, tokens),
      connectedByUserId: userId,
    });
    await this.rearmIfReady(taken.orgId);
    this.log.log(`EBM account ${account.tin} connected for org ${taken.orgId}`);
    return back('connected');
  }

  // -------------------------------------------------------------------------
  // Reading and configuring
  // -------------------------------------------------------------------------

  async status(orgId: string): Promise<EbmConnection> {
    let row = await this.connections.findByOrg(orgId);

    // The provider approves an account on its own schedule. Re-read its state
    // when someone is looking, so an account RRA approved an hour ago shows as
    // approved — and its held sales go out — without anyone reconnecting.
    if (row?.status === 'connected' && row.accountStatus !== APPROVED && this.live) {
      try {
        const creds = await this.freshToken(row);
        if (creds) {
          const account = await this.live.client.account(creds);
          if (account.status !== row.accountStatus) {
            await this.connections.saveAccountStatus(orgId, account.status);
            await this.rearmIfReady(orgId);
            row = await this.connections.findByOrg(orgId);
          }
        }
      } catch (error) {
        // Best effort. The stored state is still true as of when it was read.
        this.log.warn(`EBM account status not refreshed for org ${orgId}: ${String(error)}`);
      }
    }

    const heldSaleCount = await this.connections.heldSaleCount(orgId);
    // The demo is never certified whatever the process mode (ADR-041 D-p).
    const mode = this.live && this.platform.environment !== 'demo' ? 'live' : 'mock';
    if (!row) {
      return {
        mode,
        status: 'not_connected',
        tin: null,
        accountName: null,
        accountStatus: null,
        branchId: null,
        vatRegistered: null,
        scopes: [],
        connectedAt: null,
        mapping: { accommodationItemId: null, serviceFeeItemId: null, walkInCustomerId: null },
        isReady: false,
        heldSaleCount,
      };
    }
    return {
      mode,
      status: row.status,
      tin: row.tin,
      accountName: row.accountName,
      accountStatus: toAccountStatus(row.accountStatus),
      branchId: row.branchId,
      vatRegistered: row.vatRegistered,
      scopes: row.scopes,
      connectedAt: row.connectedAt.toISOString(),
      mapping: mappingOf(row),
      isReady: notReadyReason(row) === null,
      heldSaleCount,
    };
  }

  async catalog(orgId: string, search?: string): Promise<EbmCatalogItem[]> {
    const { client, token } = await this.clientFor(orgId);
    const { items } = await this.provider(() =>
      client.items(token, { search, limit: CATALOG_PAGE }),
    );
    return items.map((item) => ({
      id: item.id,
      itemCd: item.itemCd,
      itemNm: item.itemNm,
      taxTyCd: (['A', 'B', 'C', 'D'].includes(item.taxTyCd) ? item.taxTyCd : 'B') as EbmCatalogItem['taxTyCd'],
      unitPriceRwf: item.unitPrice,
    }));
  }

  async customers(orgId: string, search?: string): Promise<EbmCustomerOption[]> {
    const { client, token } = await this.clientFor(orgId);
    const { customers } = await this.provider(() =>
      client.customers(token, { search, limit: CATALOG_PAGE }),
    );
    return customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      tin: customer.tin && customer.tin.trim() !== '' ? customer.tin : null,
    }));
  }

  /**
   * Save which catalog items a stay is sold as, after checking each against
   * the taxpayer's live catalog.
   *
   * The items must be taxed at `B`: the receipt this platform prints for a stay
   * is priced at VAT B-18% (`receipt-builder.ts`), and certifying it against an
   * exempt or zero-rated item would declare a different tax than the receipt
   * shows. A non-VAT host needs the 0% codes, which is open question O-1 and
   * not built; refusing here is the honest answer until it is.
   *
   * The walk-in customer must carry no TIN. A customer WITH a TIN makes the sale
   * B2B, which the provider refuses without the buyer's purchase order code —
   * something a booking guest never has.
   */
  async saveMapping(orgId: string, input: EbmItemMappingInput): Promise<EbmConnection> {
    const { client, token } = await this.clientFor(orgId);

    for (const [field, id] of [
      ['accommodation item', input.accommodationItemId],
      ['service fee item', input.serviceFeeItemId],
    ] as const) {
      if (id === null) continue;
      const item = await this.findItem(client, token, id);
      if (!item) {
        throw new BadRequestException(`The ${field} (${id}) is not in this business's EBM catalog.`);
      }
      if (item.taxTyCd !== 'B') {
        throw new BadRequestException(
          `The ${field} "${item.itemNm}" is taxed at ${item.taxTyCd}. Stays are invoiced at VAT B-18%; pick an item taxed at B.`,
        );
      }
    }

    if (input.walkInCustomerId !== null) {
      const customer = await this.findCustomer(client, token, input.walkInCustomerId);
      if (!customer) {
        throw new BadRequestException(
          `Customer ${input.walkInCustomerId} is not in this business's EBM customer list.`,
        );
      }
      if (customer.tin && customer.tin.trim() !== '') {
        throw new BadRequestException(
          `"${customer.name}" has a TIN, which makes every stay a business-to-business sale. Pick a walk-in customer with no TIN.`,
        );
      }
    }

    const saved = await this.connections.saveMapping(orgId, input);
    if (!saved) throw new ConflictException('Connect the EBM account before choosing items.');
    await this.rearmIfReady(orgId);
    return this.status(orgId);
  }

  async disconnect(orgId: string, userId: string): Promise<EbmConnection> {
    const row = await this.connections.findByOrg(orgId);
    if (row?.status === 'connected' && this.live) {
      try {
        const refresh = row.refreshTokenCiphertext
          ? this.live.config.cipher.decrypt(row.refreshTokenCiphertext, this.refreshContext(orgId))
          : null;
        const access = this.live.config.cipher.decrypt(row.accessTokenCiphertext, this.accessContext(orgId));
        if (refresh) await this.revokeQuietly(refresh);
        await this.revokeQuietly(access);
      } catch (error) {
        this.log.warn(`EBM tokens for org ${orgId} could not be opened to revoke: ${String(error)}`);
      }
    }
    if (row) await this.connections.revoke(orgId, `disconnected by user ${userId}`);
    return this.status(orgId);
  }

  // -------------------------------------------------------------------------
  // For the emission worker
  // -------------------------------------------------------------------------

  /**
   * Whether this org may certify a sale right now, and the token to do it with.
   *
   * Throws `EbmApiError('unavailable')` only when the provider could not be
   * reached to refresh a token — a temporary state the worker retries. Every
   * other "no" is a reason the business has to fix, returned rather than
   * thrown.
   */
  async credentialsFor(orgId: string, opts: { forceRefresh?: boolean } = {}): Promise<Credentials> {
    if (this.platform.environment === 'demo') return { ready: false, reason: 'the demo environment is never certified' };
    if (!this.live) return { ready: false, reason: 'RRA invoicing is in mock mode' };
    const row = await this.connections.findByOrg(orgId);
    if (!row) {
      return { ready: false, reason: 'This business has not connected its RRA EBM account.' };
    }
    const reason = notReadyReason(row);
    if (reason) return { ready: false, reason };

    const token = await this.freshToken(row, opts.forceRefresh);
    if (!token) {
      return {
        ready: false,
        reason: 'The RRA EBM authorisation expired or was withdrawn. Reconnect the account.',
      };
    }
    return { ready: true, accessToken: token, tin: row.tin, mapping: mappingOf(row) };
  }

  /** Called by the worker when the provider refused a token even after refresh. */
  async markRevoked(orgId: string, reason: string): Promise<void> {
    await this.connections.revoke(orgId, reason);
  }

  // -------------------------------------------------------------------------

  /**
   * A usable access token, refreshing it when it is about to expire. Null when
   * the connection can no longer be renewed (and it is then marked revoked).
   */
  private async freshToken(
    row: EbmConnectionRow,
    forceRefresh = false,
  ): Promise<string | null> {
    const live = this.requireLive();
    const cipher = live.config.cipher;
    const nearExpiry =
      row.accessTokenExpiresAt.getTime() - this.now().getTime() < REFRESH_MARGIN_MS;
    if (!forceRefresh && !nearExpiry) {
      return cipher.decrypt(row.accessTokenCiphertext, this.accessContext(row.orgId));
    }
    if (!row.refreshTokenCiphertext) {
      await this.connections.revoke(row.orgId, 'the access token expired and the provider issued no refresh token');
      return null;
    }

    const refreshToken = cipher.decrypt(row.refreshTokenCiphertext, this.refreshContext(row.orgId));
    try {
      const tokens = await live.client.refresh(refreshToken);
      await this.connections.saveTokens(row.orgId, this.seal(row.orgId, tokens, refreshToken));
      return tokens.accessToken;
    } catch (error) {
      if (error instanceof EbmApiError && error.kind === 'unavailable') throw error;

      // A refused refresh may be a RACE, not a revocation: with rotating
      // refresh tokens, a second worker that refreshed a moment ago has already
      // spent the one we hold. If the stored token moved on, use the new one
      // rather than revoke a connection that is working fine.
      const current = await this.connections.findByOrg(row.orgId);
      if (
        current?.status === 'connected' &&
        current.accessTokenCiphertext !== row.accessTokenCiphertext &&
        current.accessTokenExpiresAt.getTime() - this.now().getTime() > REFRESH_MARGIN_MS
      ) {
        return cipher.decrypt(current.accessTokenCiphertext, this.accessContext(row.orgId));
      }
      await this.connections.revoke(
        row.orgId,
        `the provider refused to renew the authorisation: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Seal a token set for storage. A refresh that returns no new refresh token
   * keeps the old one (`previousRefresh`): providers that do not rotate simply
   * omit it, and dropping it would end the connection at the next expiry.
   */
  private seal(orgId: string, tokens: EbmTokenSet, previousRefresh?: string): SealedTokens {
    const cipher = this.requireLive().config.cipher;
    const refresh = tokens.refreshToken ?? previousRefresh ?? null;
    return {
      accessTokenCiphertext: cipher.encrypt(tokens.accessToken, this.accessContext(orgId)),
      refreshTokenCiphertext: refresh ? cipher.encrypt(refresh, this.refreshContext(orgId)) : null,
      accessTokenExpiresAt: tokens.expiresAt,
    };
  }

  private async clientFor(orgId: string): Promise<{ client: EbmApiClient; token: string }> {
    const live = this.requireLive();
    const row = await this.connections.findByOrg(orgId);
    if (!row || row.status !== 'connected') {
      throw new ConflictException('Connect the EBM account first.');
    }
    const token = await this.provider(() => this.freshToken(row));
    if (!token) {
      throw new ConflictException('The EBM authorisation expired or was withdrawn. Reconnect the account.');
    }
    return { client: live.client, token };
  }

  /** A provider outage becomes a 503 an operator can read, never a raw 500. */
  private async provider<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof EbmApiError) {
        throw new ServiceUnavailableException(
          `The EBM provider could not answer (${error.kind}). Try again shortly.`,
        );
      }
      throw error;
    }
  }

  private async findItem(client: EbmApiClient, token: string, id: number): Promise<EbmItem | null> {
    for (let page = 1; page <= MAX_CATALOG_PAGES; page += 1) {
      const { items } = await this.provider(() => client.items(token, { page, limit: CATALOG_PAGE }));
      const hit = items.find((item) => item.id === id);
      if (hit) return hit;
      if (items.length < CATALOG_PAGE) return null;
    }
    return null;
  }

  private async findCustomer(client: EbmApiClient, token: string, id: number): Promise<EbmCustomer | null> {
    for (let page = 1; page <= MAX_CATALOG_PAGES; page += 1) {
      const { customers } = await this.provider(() =>
        client.customers(token, { page, limit: CATALOG_PAGE }),
      );
      const hit = customers.find((customer) => customer.id === id);
      if (hit) return hit;
      if (customers.length < CATALOG_PAGE) return null;
    }
    return null;
  }

  private async rearmIfReady(orgId: string): Promise<void> {
    const row = await this.connections.findByOrg(orgId);
    if (row && notReadyReason(row) === null) {
      const n = await this.connections.rearmHeld(orgId, this.now());
      if (n > 0) this.log.log(`EBM connection for org ${orgId} is ready; ${n} held sale(s) re-armed`);
    }
  }

  private async revokeQuietly(token: string): Promise<void> {
    try {
      await this.requireLive().client.revoke(token);
    } catch (error) {
      this.log.warn(`EBM token revocation did not complete: ${String(error)}`);
    }
  }
}

/** The placeholder `EBM_CONNECT_RETURN_URL` names the workspace with. */
export const WORKSPACE_PLACEHOLDER = '{workspaceId}';

/**
 * Where the consent round trip lands. `EBM_CONNECT_RETURN_URL` is a template
 * (`…/w/{workspaceId}/settings/integrations`) because operator screens are
 * addressed by workspace. Before the state is redeemed nobody knows which
 * workspace it was — an expired or forged state names none — so the person goes
 * to the app's front door, which routes them to a workspace they hold.
 */
export function connectReturnUrl(template: string, workspaceId: string | null): URL {
  if (!template.includes(WORKSPACE_PLACEHOLDER)) return new URL(template);
  if (workspaceId) {
    return new URL(template.replace(WORKSPACE_PLACEHOLDER, encodeURIComponent(workspaceId)));
  }
  return new URL('/', new URL(template.replace(WORKSPACE_PLACEHOLDER, 'x')));
}

function mappingOf(row: EbmConnectionRow): EbmItemMapping {
  return {
    accommodationItemId: row.accommodationItemId,
    serviceFeeItemId: row.serviceFeeItemId,
    walkInCustomerId: row.walkInCustomerId,
  };
}

/**
 * The one definition of "this business may invoice", in the words shown when
 * it may not. `isReady` on the wire and the worker's gate both come from here.
 */
export function notReadyReason(row: EbmConnectionRow): string | null {
  if (row.status !== 'connected') {
    return 'The RRA EBM authorisation was withdrawn. Reconnect the account.';
  }
  if (row.accountStatus !== APPROVED) {
    return row.accountStatus === 'disabled'
      ? 'The EBM account is disabled at the provider.'
      : 'The EBM account is waiting for RRA approval.';
  }
  if (row.accommodationItemId === null) {
    return 'Choose which EBM catalog item a room night is sold as.';
  }
  if (row.serviceFeeItemId === null) {
    return 'Choose which EBM catalog item the booking service fee is sold as.';
  }
  if (row.walkInCustomerId === null) {
    return 'Choose the EBM walk-in customer that booking guests are billed to.';
  }
  return null;
}
