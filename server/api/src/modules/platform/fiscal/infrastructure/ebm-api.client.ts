import { Logger } from '@nestjs/common';
import { z } from 'zod';

/**
 * The HTTP client for the Injishi EBM provider's v1 integration API (ADR-041).
 *
 * The provider (`test-ebm-api.injishi.com` for test) is a Certified Invoicing
 * System in front of RRA's VSDC: it holds each taxpayer's registered catalog and
 * customers, and `POST /api/v1/invoices` "creates a sale invoice and immediately
 * certifies it with RRA via VSDC". Authorisation is per taxpayer, OAuth 2.0
 * Authorization Code + PKCE; there is no machine-to-machine grant, so every call
 * that touches a taxpayer's data carries THAT taxpayer's bearer token.
 *
 * This is the first outbound HTTP call in this service. Two rules it exists to
 * keep, and every other line serves one of them:
 *
 * 1. **A certified sale must never be sent twice.** The invoice POST carries no
 *    idempotency key, so the provider cannot deduplicate a retry. That makes the
 *    classification of a failure a fiscal question, not a networking one: a
 *    request that certainly never reached the provider may be retried; one that
 *    may have reached it must NOT be retried blindly, because it may already be a
 *    certified sale and a second send declares the stay twice. `classify()` is
 *    the one place that decision is made.
 * 2. **A credential never reaches a log line.** Errors carry the status and the
 *    provider's message, never a header, a token or a request body.
 *
 * The provider's field names (`intrlData`, `rcptSign`, ...) stay inside this
 * module. They are RRA's VSDC vocabulary, and `@injishi/contracts` is for shapes
 * this platform defines.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface EbmApiConfig {
  /** e.g. `https://test-ebm-api.injishi.com`. No trailing slash needed. */
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  /** Must equal the redirect URI registered with the provider, byte for byte. */
  redirectUri: string;
  /** Per call ceiling. A hung call must fail, not hold a worker forever. */
  timeoutMs: number;
}

/**
 * The scopes the platform asks a taxpayer for. Exactly what the invoice path
 * uses and nothing more: reading the account, reading the catalog and the
 * customer list to set up the mapping, and creating and reading invoices.
 * `invoices:refund` is NOT requested — refunds (clause 14, `NR`) are not built,
 * and asking for a power the platform does not use is asking the taxpayer to
 * trust it with more than it needs.
 */
export const EBM_SCOPES = [
  'ebm:read',
  'items:read',
  'customers:read',
  'invoices:create',
  'invoices:read',
] as const;

// ---------------------------------------------------------------------------
// Failure classification
// ---------------------------------------------------------------------------

/**
 * What went wrong, in the terms that decide what happens next.
 *
 * - `rejected` — the provider understood the request and refused it (a 4xx
 *   validation error: an unmapped item, a missing customer). Nothing was
 *   certified. Retrying the same request will be refused the same way; a
 *   person has to change something.
 * - `unauthorized` — the token was refused. Nothing was certified. Refresh and
 *   try once more; if that fails too the connection is revoked.
 * - `unavailable` — the request certainly did not produce a certified sale: it
 *   never left this process, the connection was refused, or the provider said
 *   the VSDC was unreachable. Safe to retry.
 * - `unknown_outcome` — the request may have been received and acted on, and no
 *   answer came back that says whether it was: a timeout after sending, a reset
 *   connection, a 500, a gateway timeout, a 2xx whose body cannot be read.
 *   NEVER retried automatically.
 */
export type EbmFailureKind =
  | 'rejected'
  | 'unauthorized'
  | 'unavailable'
  | 'unknown_outcome';

export class EbmApiError extends Error {
  constructor(
    readonly kind: EbmFailureKind,
    /** The HTTP status, or null when no response arrived. */
    readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'EbmApiError';
  }
}

/**
 * Connection failures that happen BEFORE a byte of the request is delivered.
 * Only these make a network error safe to retry; a reset or a socket error
 * after connecting may have delivered the whole request.
 */
const NOT_DELIVERED_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

/** Walks `error.cause` for a Node/undici error code. */
function networkCode(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

function isTimeout(error: unknown): boolean {
  const name = (error as { name?: unknown })?.name;
  return name === 'TimeoutError' || name === 'AbortError';
}

/**
 * Classify a failed call. `mutating` is whether the call can change fiscal
 * state at the provider — only the invoice POST can. A read that times out is
 * simply `unavailable`: repeating a read cannot declare anything.
 */
export function classifyNetworkError(
  error: unknown,
  mutating: boolean,
): EbmApiError {
  if (!mutating) {
    return new EbmApiError(
      'unavailable',
      null,
      `EBM provider unreachable: ${describe(error)}`,
    );
  }
  if (isTimeout(error)) {
    return new EbmApiError(
      'unknown_outcome',
      null,
      'EBM provider did not answer in time; the invoice may or may not have been certified',
    );
  }
  const code = networkCode(error);
  if (code && NOT_DELIVERED_CODES.has(code)) {
    return new EbmApiError(
      'unavailable',
      null,
      `EBM provider unreachable before the request was sent (${code})`,
    );
  }
  return new EbmApiError(
    'unknown_outcome',
    null,
    `connection to the EBM provider failed mid-request (${code ?? describe(error)}); the invoice may or may not have been certified`,
  );
}

/** Classify a non-2xx response. */
export function classifyStatus(
  status: number,
  mutating: boolean,
  detail: string,
): EbmApiError {
  if (status === 401 || status === 403) {
    return new EbmApiError('unauthorized', status, `EBM provider refused the token: ${detail}`);
  }
  // 408 and 429 are the provider declining to process the request at all.
  if (status === 408 || status === 429) {
    return new EbmApiError('unavailable', status, `EBM provider is busy (${status}): ${detail}`);
  }
  if (status >= 400 && status < 500) {
    return new EbmApiError('rejected', status, `EBM provider rejected the request (${status}): ${detail}`);
  }
  // 502 is documented as "VSDC is unreachable"; 503 is the provider (or its
  // proxy) not serving. In both the sale was not certified.
  if (status === 502 || status === 503) {
    return new EbmApiError('unavailable', status, `EBM provider or VSDC unavailable (${status}): ${detail}`);
  }
  // 500 and 504 are the dangerous pair: the provider may have crashed AFTER
  // certifying, and a gateway timeout means the upstream may still be working
  // on it. For a read that is only an outage; for the invoice POST it is an
  // outcome nobody can know.
  return new EbmApiError(
    mutating ? 'unknown_outcome' : 'unavailable',
    status,
    `EBM provider failed (${status}): ${detail}`,
  );
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 200);
  return String(error).slice(0, 200);
}

// ---------------------------------------------------------------------------
// Provider shapes (theirs, parsed at the edge)
// ---------------------------------------------------------------------------

const TokenResponse = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  /**
   * Optional in practice even where documented. A token with no stated life is
   * treated as a short one (see `tokenSetFrom`), because assuming a long life
   * for a token that has already expired sends a sale with a dead credential.
   */
  expires_in: z.coerce.number().int().positive().optional(),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional(),
});

export interface EbmTokenSet {
  accessToken: string;
  /** Null when the provider issued none; the connection then cannot renew. */
  refreshToken: string | null;
  expiresAt: Date;
  scopes: string[];
}

/** Used when the provider states no lifetime. Deliberately short. */
const DEFAULT_TOKEN_LIFETIME_S = 300;

function tokenSetFrom(raw: unknown, now: Date): EbmTokenSet {
  const parsed = TokenResponse.safeParse(raw);
  if (!parsed.success) {
    throw new EbmApiError(
      'rejected',
      200,
      'EBM provider answered the token request without an access token',
    );
  }
  const token = parsed.data;
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    expiresAt: new Date(
      now.getTime() + (token.expires_in ?? DEFAULT_TOKEN_LIFETIME_S) * 1000,
    ),
    scopes: (token.scope ?? '').split(/\s+/).filter(Boolean),
  };
}

const EbmAccountResponse = z.object({
  data: z.object({
    id: z.number().int().optional(),
    name: z.string().nullable().optional(),
    tin: z.string().min(1),
    bhfId: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    vatRegistered: z.boolean().nullable().optional(),
  }),
});

export interface EbmAccount {
  name: string | null;
  tin: string;
  branchId: string | null;
  /** `submitted` | `approved` | `disabled`, or whatever the provider says. */
  status: string | null;
  vatRegistered: boolean | null;
}

const ItemRow = z.object({
  id: z.number().int(),
  itemCd: z.string().nullable().optional(),
  itemNm: z.string().nullable().optional(),
  taxTyCd: z.string().nullable().optional(),
  unitPrice: z.coerce.number().nullable().optional(),
});

const PageMeta = z
  .object({
    total: z.number().int().optional(),
    page: z.number().int().optional(),
    limit: z.number().int().optional(),
  })
  .optional();

const ItemPage = z.object({ data: z.array(ItemRow), meta: PageMeta });

export interface EbmItem {
  id: number;
  itemCd: string;
  itemNm: string;
  taxTyCd: string;
  unitPrice: number;
}

const CustomerRow = z.object({
  id: z.number().int(),
  name: z.string().nullable().optional(),
  tin: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
});

const CustomerPage = z.object({ data: z.array(CustomerRow), meta: PageMeta });

export interface EbmCustomer {
  id: number;
  name: string;
  tin: string | null;
  status: string | null;
}

/**
 * `POST /api/v1/invoices` — the documented `InvoiceCreateRequest`.
 *
 * `paymentMethod` is RRA's `pmtTyCd` from VSDC spec §4.10 (01 cash, 02 credit,
 * 03 cash/credit, 04 bank check, 05 card, 06 mobile money, 07 other). The
 * provider's own docs label the codes differently (04 "Mobile Money", 06
 * "Bank Transfer"); where they disagree RRA's table wins, because the code is
 * what reaches RRA. See ADR-041.
 */
export interface EbmInvoiceRequest {
  customerId: number;
  paymentMethod: string;
  /** Total discount in RWF; the provider spreads it across the items. */
  discount?: number;
  items: Array<{ id: number; quantity: number; unitPrice: number }>;
}

/**
 * The certified invoice, kept RAW.
 *
 * `raw` is the whole parsed body and is what gets stored: it is the only record
 * of what the Authority answered, and a field this client does not yet read
 * (the documented schema omits `totRcptNo` and `vsdcRcptPbctDate`, which RRA's
 * own `saveSales` response carries) must not be thrown away before anyone has
 * looked. `domain/vsdc-response.ts` reads the device's fields out of it.
 */
export interface EbmCertifiedInvoice {
  id: number;
  status: string | null;
  raw: Record<string, unknown>;
}

const CertifiedEnvelope = z
  .object({
    id: z.number().int(),
    status: z.string().nullable().optional(),
  })
  .passthrough();

/** The body is either the invoice, or `{ data: invoice }` (the GET form). */
function certifiedFrom(body: unknown): EbmCertifiedInvoice | null {
  const candidate =
    body && typeof body === 'object' && 'data' in body && (body as { data: unknown }).data
      ? (body as { data: unknown }).data
      : body;
  const parsed = CertifiedEnvelope.safeParse(candidate);
  if (!parsed.success) return null;
  return {
    id: parsed.data.id,
    status: parsed.data.status ?? null,
    raw: candidate as Record<string, unknown>,
  };
}

// ---------------------------------------------------------------------------
// The client
// ---------------------------------------------------------------------------

type FetchLike = typeof fetch;

export class EbmApiClient {
  private readonly log = new Logger(EbmApiClient.name);
  private readonly base: string;

  constructor(
    private readonly config: EbmApiConfig,
    private readonly fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
    private readonly now: () => Date = () => new Date(),
  ) {
    this.base = config.baseUrl.replace(/\/+$/, '');
  }

  /** Where to send the taxpayer's browser to consent (a redirect, not a call). */
  authorizeUrl(input: { state: string; codeChallenge: string }): string {
    const url = new URL(`${this.base}/oauth/authorize`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('scope', EBM_SCOPES.join(' '));
    url.searchParams.set('code_challenge', input.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('state', input.state);
    return url.toString();
  }

  async exchangeCode(input: {
    code: string;
    codeVerifier: string;
  }): Promise<EbmTokenSet> {
    const body = await this.form('/oauth/token', {
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code: input.code,
      redirect_uri: this.config.redirectUri,
      code_verifier: input.codeVerifier,
    });
    return tokenSetFrom(body, this.now());
  }

  async refresh(refreshToken: string): Promise<EbmTokenSet> {
    const body = await this.form('/oauth/token', {
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: refreshToken,
    });
    return tokenSetFrom(body, this.now());
  }

  /** Best effort: the provider answers 200 whether or not the token existed. */
  async revoke(token: string): Promise<void> {
    await this.form('/oauth/revoke', {
      token,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });
  }

  async account(accessToken: string): Promise<EbmAccount> {
    const body = await this.json('GET', '/api/v1/ebm', accessToken);
    const parsed = EbmAccountResponse.safeParse(body);
    if (!parsed.success) {
      throw new EbmApiError('rejected', 200, 'EBM provider answered /api/v1/ebm without a TIN');
    }
    const a = parsed.data.data;
    return {
      name: a.name ?? null,
      tin: a.tin.trim(),
      branchId: a.bhfId ?? null,
      status: a.status ?? null,
      vatRegistered: a.vatRegistered ?? null,
    };
  }

  async items(
    accessToken: string,
    query: { search?: string; page?: number; limit?: number } = {},
  ): Promise<{ items: EbmItem[]; total: number | null }> {
    const body = await this.json('GET', `/api/v1/items${qs(query)}`, accessToken);
    const parsed = ItemPage.safeParse(body);
    if (!parsed.success) {
      throw new EbmApiError('rejected', 200, 'EBM provider answered /api/v1/items in an unexpected shape');
    }
    return {
      items: parsed.data.data.map((row) => ({
        id: row.id,
        itemCd: row.itemCd ?? '',
        itemNm: row.itemNm ?? '',
        taxTyCd: row.taxTyCd ?? '',
        unitPrice: row.unitPrice ?? 0,
      })),
      total: parsed.data.meta?.total ?? null,
    };
  }

  async customers(
    accessToken: string,
    query: { search?: string; page?: number; limit?: number } = {},
  ): Promise<{ customers: EbmCustomer[]; total: number | null }> {
    const body = await this.json('GET', `/api/v1/customers${qs(query)}`, accessToken);
    const parsed = CustomerPage.safeParse(body);
    if (!parsed.success) {
      throw new EbmApiError('rejected', 200, 'EBM provider answered /api/v1/customers in an unexpected shape');
    }
    return {
      customers: parsed.data.data.map((row) => ({
        id: row.id,
        name: row.name ?? '',
        tin: row.tin ?? null,
        status: row.status ?? null,
      })),
      total: parsed.data.meta?.total ?? null,
    };
  }

  /**
   * Create AND certify a sale. The one mutating call, and the one whose failures
   * are classified with `mutating: true`.
   *
   * A 2xx whose body carries no invoice id is `unknown_outcome`, not success
   * and not a refusal: the provider said yes to something, and without its id
   * nobody can tell which fiscal record it made.
   */
  async createInvoice(
    accessToken: string,
    request: EbmInvoiceRequest,
  ): Promise<EbmCertifiedInvoice> {
    const body = await this.json('POST', '/api/v1/invoices', accessToken, request, true);
    const invoice = certifiedFrom(body);
    if (!invoice) {
      throw new EbmApiError(
        'unknown_outcome',
        200,
        'EBM provider accepted the invoice but its answer carries no invoice id; it may or may not have been certified',
      );
    }
    return invoice;
  }

  async invoice(accessToken: string, id: number): Promise<EbmCertifiedInvoice> {
    const body = await this.json('GET', `/api/v1/invoices/${id}`, accessToken);
    const invoice = certifiedFrom(body);
    if (!invoice) {
      throw new EbmApiError('rejected', 200, `EBM provider answered invoice ${id} without an id`);
    }
    return invoice;
  }

  // -------------------------------------------------------------------------

  private async form(path: string, fields: Record<string, string>): Promise<unknown> {
    return this.send(path, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: new URLSearchParams(fields).toString(),
    });
  }

  private async json(
    method: 'GET' | 'POST',
    path: string,
    accessToken: string,
    payload?: unknown,
    mutating = false,
  ): Promise<unknown> {
    return this.send(
      path,
      {
        method,
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: 'application/json',
          ...(payload === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      },
      mutating,
    );
  }

  private async send(
    path: string,
    init: RequestInit,
    mutating = false,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.base}${path}`, {
        ...init,
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      const failure = classifyNetworkError(error, mutating);
      this.log.warn(`${init.method} ${path}: ${failure.kind} — ${failure.message}`);
      throw failure;
    }

    let text: string;
    try {
      text = await response.text();
    } catch (error) {
      // The status line arrived and the body did not. For the invoice POST a
      // 2xx here means "certified, receipt lost in transit" is possible.
      const failure = response.ok
        ? classifyNetworkError(error, mutating)
        : classifyStatus(response.status, mutating, 'no body');
      this.log.warn(`${init.method} ${path}: ${failure.kind} — ${failure.message}`);
      throw failure;
    }

    const body = parseJson(text);
    if (!response.ok) {
      const failure = classifyStatus(response.status, mutating, providerMessage(body, text));
      this.log.warn(`${init.method} ${path}: ${failure.kind} — ${failure.message}`);
      throw failure;
    }
    if (body === undefined) {
      const failure = new EbmApiError(
        mutating ? 'unknown_outcome' : 'unavailable',
        response.status,
        `EBM provider answered ${response.status} with a body that is not JSON`,
      );
      this.log.warn(`${init.method} ${path}: ${failure.kind} — ${failure.message}`);
      throw failure;
    }
    return body;
  }
}

function parseJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * The provider's own words for a refusal, bounded. Its error bodies come in two
 * shapes (`{error, error_description}` from OAuth, `{error, statusCode}` or
 * `{message}` from the API); none of them echo a credential.
 */
function providerMessage(body: unknown, text: string): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const parts = [b.error_description, b.message, b.error]
      .filter((v): v is string => typeof v === 'string' && v.length > 0);
    if (parts.length > 0) return parts.join(' — ').slice(0, 300);
  }
  return text.slice(0, 300) || 'no detail';
}

function qs(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}
