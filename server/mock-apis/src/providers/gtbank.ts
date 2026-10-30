import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

import type { MockApisConfig } from '../config.ts';
import { HttpError, type Reply, type Request, type Router, header, json, sleep } from '../http.ts';
import { NationalIdNumber } from '../registers/schemas.ts';
import type { Store, Transaction, TransactionStatus } from '../store.ts';
import { isNidaOutage } from '../registers/generated.ts';
import { MIN_IMAGE_BYTES, compareFace, decodeImage } from './images.ts';

/**
 * GTBank, as Injishi will reach it: one bank, two services behind one token.
 *
 * - The NIDA gateway (`/gtbank/nida/v1`): GTBank's access to the population
 *   register, used to check a Rwandan National ID and its holder's selfie.
 * - The Payment Hub (`/gtbank/payment-hub/v1`): mobile money Request to Pay
 *   collections and disbursements to wallets and bank accounts, in RWF.
 *
 * THE WIRE IS INJISHI'S BEST MODEL, NOT GTBANK'S DOCUMENT. GTBank's
 * Integration Specifications have not been received (ADR-073, "Owed by
 * GTBank"), so every path and field here is chosen to carry what the agreement
 * names (a client reference, an amount in RWF, the six statuses, a payee's
 * name, ID, wallet and phone) and nothing it does not. When the document
 * arrives, this file and the API's two GTBank adapters change together, and
 * the mock becomes the conformance fake ADR-073 D-h asks for.
 *
 * Behaviour is scripted by register rows (`seed/wallets.json`, `citizens.json`)
 * and, for any number with no row, by its last four digits, the script
 * ADR-073 already fixed for the in-process mock: `0000` declines, `1111` is
 * slow, `2222` lacks funds, `3333` fails a payout's name check, `7777` is paid
 * then reversed, `8888` never answers, `9999` approves after the prompt window.
 */

const TOKEN_TTL_SECONDS = 3600;

type Behaviour = 'approve' | 'manual' | 'decline' | 'insufficient_funds' | 'slow' | 'late' | 'reverse' | 'hang';

function oauthError(message: string): unknown {
  return { error: 'invalid_request', error_description: message };
}

function hubError(code: string, message: string): unknown {
  return { code, message };
}

export function registerGtbank(router: Router, store: Store, config: MockApisConfig): void {
  const tokens = new Map<string, number>();
  const creds = config.credentials.gtbank;

  // --- Authentication -----------------------------------------------------

  router.on('POST', '/gtbank/oauth/token', (request) => {
    const [clientId, clientSecret] = clientCredentials(request);
    if (clientId !== creds.clientId || !same(clientSecret, creds.clientSecret)) {
      throw new HttpError(401, { error: 'invalid_client', error_description: 'Unknown client or wrong secret.' });
    }
    const grant = grantType(request);
    if (grant !== 'client_credentials') {
      throw new HttpError(400, { error: 'unsupported_grant_type', error_description: 'Use client_credentials.' });
    }
    const token = randomBytes(24).toString('base64url');
    tokens.set(token, Date.now() + TOKEN_TTL_SECONDS * 1_000);
    return {
      status: 200,
      body: { access_token: token, token_type: 'Bearer', expires_in: TOKEN_TTL_SECONDS, scope: 'nida payments' },
    };
  });

  const authorised = (request: Request): void => {
    const auth = header(request, 'authorization') ?? '';
    const token = /^Bearer\s+(.+)$/i.exec(auth)?.[1];
    const expires = token ? tokens.get(token) : undefined;
    if (!expires || expires < Date.now()) {
      throw new HttpError(401, hubError('UNAUTHORIZED', 'A valid bearer token is required.'), {
        'www-authenticate': 'Bearer error="invalid_token"',
      });
    }
  };

  // --- NIDA gateway -------------------------------------------------------

  const NidaVerification = z.object({
    requestReference: z.string().min(1).max(120),
    documentNumber: z.string(),
    selfie: z.object({ mimeType: z.string().min(1), data: z.string().min(1) }),
    purpose: z.string().default('KYC'),
  });

  router.on('POST', '/gtbank/nida/v1/identity-verifications', async (request) => {
    authorised(request);
    const parsed = NidaVerification.safeParse(json(request, (m) => hubError('INVALID_REQUEST', m)));
    if (!parsed.success) {
      throw new HttpError(400, hubError('INVALID_REQUEST', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')));
    }
    const body = parsed.data;
    if (!NationalIdNumber.safeParse(body.documentNumber).success) {
      throw new HttpError(422, hubError('INVALID_DOCUMENT_NUMBER', 'A National ID is sixteen digits.'));
    }
    if (isNidaOutage(body.documentNumber)) {
      throw new HttpError(503, hubError('NIDA_UNAVAILABLE', 'The population register did not answer. Try again later.'));
    }
    const selfie = decodeImage(body.selfie.data);
    if (!selfie || selfie.length < MIN_IMAGE_BYTES) {
      throw new HttpError(422, hubError('SELFIE_UNREADABLE', 'The selfie could not be read. Retake it in good light.'));
    }
    await sleep(250);

    const citizen = store.citizen(body.documentNumber);
    const verificationReference = `NIDA-${stamp()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const base = { verificationReference, requestReference: body.requestReference, checkedAt: new Date().toISOString() };
    if (!citizen) {
      return { status: 200, body: { ...base, result: 'NOT_FOUND', citizen: null, faceMatch: null } };
    }
    const record = {
      documentNumber: citizen.nationalId,
      foreNames: citizen.foreNames,
      surname: citizen.surname,
      dateOfBirth: citizen.dateOfBirth,
      sex: citizen.sex,
      nationality: 'RWANDAN',
      documentStatus: citizen.scenario === 'revoked' ? 'REVOKED' : 'VALID',
    };
    if (citizen.scenario === 'revoked') {
      return { status: 200, body: { ...base, result: 'REVOKED', citizen: record, faceMatch: null } };
    }
    if (citizen.scenario === 'face_not_checked') {
      return { status: 200, body: { ...base, result: 'NOT_CHECKED', citizen: record, faceMatch: null } };
    }
    const face = compareFace({
      selfie,
      documentNumber: citizen.nationalId,
      forceMismatch: citizen.scenario === 'face_mismatch',
    });
    const score = face === 'match' ? 88 + (selfie[selfie.length - 1]! % 10) : 12 + (selfie[0]! % 20);
    return {
      status: 200,
      body: {
        ...base,
        result: face === 'match' ? 'MATCH' : 'NO_MATCH',
        citizen: record,
        faceMatch: { score, threshold: 75 },
      },
    };
  });

  router.on('GET', '/gtbank/nida/v1/citizens/:documentNumber', (request) => {
    authorised(request);
    const id = request.params.documentNumber!;
    if (!NationalIdNumber.safeParse(id).success) {
      throw new HttpError(422, hubError('INVALID_DOCUMENT_NUMBER', 'A National ID is sixteen digits.'));
    }
    if (isNidaOutage(id)) throw new HttpError(503, hubError('NIDA_UNAVAILABLE', 'The population register did not answer.'));
    const citizen = store.citizen(id);
    if (!citizen) throw new HttpError(404, hubError('NOT_FOUND', 'No citizen holds this National ID.'));
    return {
      status: 200,
      body: {
        documentNumber: citizen.nationalId,
        foreNames: citizen.foreNames,
        surname: citizen.surname,
        dateOfBirth: citizen.dateOfBirth,
        sex: citizen.sex,
        nationality: 'RWANDAN',
        documentStatus: citizen.scenario === 'revoked' ? 'REVOKED' : 'VALID',
      },
    };
  });

  // --- Payment Hub --------------------------------------------------------

  const Network = z.enum(['MTN', 'AIRTEL']);
  const Collection = z.object({
    clientReference: z.string().min(1).max(120),
    amount: z.number().int().positive(),
    currency: z.literal('RWF'),
    payer: z.object({ msisdn: z.string().regex(/^\+250\d{9}$/), network: Network }),
    narration: z.string().max(140).optional(),
    callbackUrl: z.string().url().optional(),
  });

  router.on('POST', '/gtbank/payment-hub/v1/collections', async (request) => {
    authorised(request);
    const parsed = Collection.safeParse(json(request, (m) => hubError('INVALID_REQUEST', m)));
    if (!parsed.success) throw invalid(parsed.error);
    const body = parsed.data;

    const replay = store.findByClientReference('collection', body.clientReference);
    if (replay) return replayOf(replay, body.amount);

    if (!networkMatches(body.payer.msisdn, body.payer.network)) {
      throw new HttpError(422, hubError('NETWORK_MISMATCH', `${body.payer.msisdn} is not a ${body.payer.network} number.`));
    }
    const behaviour = behaviourOf(store, body.payer.msisdn);
    const now = Date.now();
    const tx = newTransaction({
      clientReference: body.clientReference,
      type: 'collection',
      amount: body.amount,
      msisdn: body.payer.msisdn,
      network: body.payer.network,
      narration: body.narration ?? null,
      callbackUrl: body.callbackUrl ?? null,
    });
    const t = config.timing;
    switch (behaviour) {
      case 'approve':
        tx.next = { status: 'successful', at: iso(now + t.momoApprovalMs), reason: null };
        break;
      case 'slow':
        tx.next = { status: 'successful', at: iso(now + t.slowMs), reason: null };
        break;
      case 'late':
        tx.next = { status: 'successful', at: iso(now + t.lateApprovalMs), reason: null };
        break;
      case 'reverse':
        tx.next = { status: 'successful', at: iso(now + t.momoApprovalMs), reason: null };
        tx.reversesAt = iso(now + t.momoApprovalMs + t.reversalAfterMs);
        break;
      case 'decline':
        tx.next = { status: 'rejected', at: iso(now + 2_000), reason: 'PAYER_DECLINED' };
        break;
      case 'insufficient_funds':
        tx.next = { status: 'failed', at: iso(now + 2_000), reason: 'INSUFFICIENT_FUNDS' };
        break;
      case 'manual':
      case 'hang':
        tx.next = null;
        break;
    }
    store.addTransaction(tx);
    // `8888`: the request arrived, and the answer never comes back in time.
    if (behaviour === 'hang') await sleep(t.hangMs);
    return { status: 202, body: present(tx) };
  });

  const Disbursement = z.object({
    clientReference: z.string().min(1).max(120),
    amount: z.number().int().positive(),
    currency: z.literal('RWF'),
    beneficiary: z.object({
      fullName: z.string().min(1),
      idType: z.enum(['NATIONAL_ID', 'PASSPORT']),
      idNumber: z.string().min(5),
      phone: z.string().min(8),
      destination: z.discriminatedUnion('type', [
        z.object({ type: z.literal('WALLET'), msisdn: z.string().regex(/^\+250\d{9}$/), network: Network }),
        z.object({ type: z.literal('BANK'), bankCode: z.string().min(2), accountNumber: z.string().min(5) }),
      ]),
    }),
    narration: z.string().max(140).optional(),
    callbackUrl: z.string().url().optional(),
  });
  const shortOnce = new Set<string>();

  router.on('POST', '/gtbank/payment-hub/v1/disbursements', async (request) => {
    authorised(request);
    const parsed = Disbursement.safeParse(json(request, (m) => hubError('INVALID_REQUEST', m)));
    if (!parsed.success) throw invalid(parsed.error);
    const body = parsed.data;

    const replay = store.findByClientReference('disbursement', body.clientReference);
    if (replay) return replayOf(replay, body.amount);

    const destination = body.beneficiary.destination;
    const account = destination.type === 'WALLET' ? destination.msisdn : destination.accountNumber;
    const tx = newTransaction({
      clientReference: body.clientReference,
      type: 'disbursement',
      amount: body.amount,
      msisdn: destination.type === 'WALLET' ? destination.msisdn : null,
      network: destination.type === 'WALLET' ? destination.network : null,
      bank: destination.type === 'BANK' ? { bankCode: destination.bankCode, accountNumber: destination.accountNumber } : null,
      beneficiaryName: body.beneficiary.fullName,
      narration: body.narration ?? null,
      callbackUrl: body.callbackUrl ?? null,
    });
    const now = Date.now();
    const wallet = destination.type === 'WALLET' ? store.wallet(destination.msisdn) : null;
    const nameMismatch =
      account.endsWith('3333') || (wallet !== null && normalise(wallet.holderName) !== normalise(body.beneficiary.fullName));

    if (account.endsWith('0000')) {
      end(tx, 'rejected', 'DESTINATION_REFUSED');
    } else if (nameMismatch) {
      end(tx, 'rejected', 'NAME_MISMATCH');
    } else if (account.endsWith('2222') && !shortOnce.has(body.clientReference)) {
      shortOnce.add(body.clientReference);
      end(tx, 'failed', 'INSUFFICIENT_FUNDS');
    } else if (account.endsWith('1111')) {
      tx.next = { status: 'successful', at: iso(now + config.timing.slowMs), reason: null };
    } else if (account.endsWith('8888')) {
      tx.next = null;
    } else {
      end(tx, 'successful', null);
      if (account.endsWith('7777')) tx.reversesAt = iso(now + config.timing.reversalAfterMs);
    }
    // A refusal at the door is still a transaction the bank recorded: a retry
    // with the same reference reads it back rather than trying again.
    store.addTransaction(tx);
    if (account.endsWith('8888')) await sleep(config.timing.hangMs);
    return { status: 202, body: present(tx) };
  });

  router.on('GET', '/gtbank/payment-hub/v1/transactions/:reference', (request) => {
    authorised(request);
    const tx = store.findTransaction(request.params.reference!);
    if (!tx) throw new HttpError(404, hubError('NOT_FOUND', 'No transaction has this reference.'));
    advance(store, tx);
    return { status: 200, body: present(tx) };
  });

  // Reconciliation by OUR reference, for a request whose answer never came back.
  router.on('GET', '/gtbank/payment-hub/v1/transactions', (request) => {
    authorised(request);
    const clientReference = request.query.get('clientReference');
    const type = request.query.get('type');
    if (!clientReference || (type !== 'collection' && type !== 'disbursement')) {
      throw new HttpError(400, hubError('INVALID_REQUEST', 'clientReference and type (collection or disbursement) are required.'));
    }
    const tx = store.findByClientReference(type, clientReference);
    if (tx) advance(store, tx);
    return { status: 200, body: { items: tx ? [present(tx)] : [] } };
  });

  router.on('POST', '/gtbank/payment-hub/v1/collections/:reference/cancel', (request) => {
    authorised(request);
    const tx = store.findTransaction(request.params.reference!);
    if (!tx || tx.type !== 'collection') throw new HttpError(404, hubError('NOT_FOUND', 'No collection has this reference.'));
    advance(store, tx);
    if (tx.status !== 'pending') {
      throw new HttpError(409, hubError('NOT_PENDING', `The collection is already ${tx.status}.`));
    }
    end(tx, 'cancelled', 'CANCELLED_BY_MERCHANT');
    store.save();
    return { status: 200, body: present(tx) };
  });

  // --- Helpers ------------------------------------------------------------

  function replayOf(tx: Transaction, amount: number): Reply {
    if (tx.amount !== amount) {
      throw new HttpError(409, hubError('DUPLICATE_REFERENCE', 'This client reference was already used for another amount.'));
    }
    advance(store, tx);
    return { status: 200, body: present(tx) };
  }
}

/** Move a transaction along the clock, once per change, and send its callback. */
export function advance(store: Store, tx: Transaction, now: number = Date.now()): boolean {
  let changed = false;
  if (tx.status === 'pending' && tx.next && now >= Date.parse(tx.next.at)) {
    tx.status = tx.next.status;
    tx.statusReason = tx.next.reason;
    tx.updatedAt = tx.next.at;
    tx.next = null;
    changed = true;
  }
  if (tx.status === 'successful' && tx.reversesAt && now >= Date.parse(tx.reversesAt)) {
    tx.status = 'reversed';
    tx.statusReason = 'REVERSED_BY_NETWORK';
    tx.updatedAt = tx.reversesAt;
    tx.reversesAt = null;
    changed = true;
  }
  if (changed) store.save();
  return changed;
}

/** Settle a pending transaction from the console, as the handset would. */
export function decide(store: Store, tx: Transaction, decision: 'approve' | 'decline' | 'reverse'): void {
  advance(store, tx);
  if (decision === 'reverse') {
    if (tx.status !== 'successful') throw new HttpError(409, { error: `Only a successful transaction can be reversed; this one is ${tx.status}.` });
    end(tx, 'reversed', 'REVERSED_BY_NETWORK');
  } else {
    if (tx.status !== 'pending') throw new HttpError(409, { error: `This transaction is already ${tx.status}.` });
    if (decision === 'approve') end(tx, 'successful', null);
    else end(tx, 'rejected', 'PAYER_DECLINED');
  }
  store.save();
}

/** The transaction as the Payment Hub reports it. */
export function present(tx: Transaction): Record<string, unknown> {
  return {
    transactionReference: tx.transactionReference,
    clientReference: tx.clientReference,
    type: tx.type,
    amount: tx.amount,
    currency: tx.currency,
    status: tx.status,
    statusReason: tx.statusReason,
    fee: tx.fee,
    ...(tx.type === 'collection'
      ? { payer: { msisdn: tx.msisdn, network: tx.network } }
      : {
          beneficiary: {
            fullName: tx.beneficiaryName,
            destination: tx.bank
              ? { type: 'BANK', bankCode: tx.bank.bankCode, accountNumber: tx.bank.accountNumber }
              : { type: 'WALLET', msisdn: tx.msisdn, network: tx.network },
          },
        }),
    narration: tx.narration,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
  };
}

/** A signed callback for a status change, if the transaction asked for one. Fire and forget. */
export async function notify(tx: Transaction, webhookSecret: string): Promise<void> {
  if (!tx.callbackUrl || tx.notified.includes(tx.status) || tx.status === 'pending') return;
  tx.notified.push(tx.status);
  const raw = JSON.stringify({
    eventId: `EVT-${tx.transactionReference}-${tx.status.toUpperCase()}`,
    eventType: 'transaction.status_changed',
    transaction: present(tx),
  });
  const signature = createHmac('sha256', webhookSecret).update(raw).digest('hex');
  try {
    await fetch(tx.callbackUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-gtbank-signature': `sha256=${signature}` },
      body: raw,
      signal: AbortSignal.timeout(5_000),
    });
  } catch (error) {
    console.warn(`[mock-apis] callback to ${tx.callbackUrl} failed: ${(error as Error).message}`);
  }
}

function newTransaction(input: {
  clientReference: string;
  type: Transaction['type'];
  amount: number;
  msisdn: string | null;
  network: 'MTN' | 'AIRTEL' | null;
  bank?: Transaction['bank'];
  beneficiaryName?: string | null;
  narration: string | null;
  callbackUrl: string | null;
}): Transaction {
  const now = new Date().toISOString();
  return {
    transactionReference: `GTB${stamp()}${randomBytes(4).toString('hex').toUpperCase()}`,
    clientReference: input.clientReference,
    type: input.type,
    amount: input.amount,
    currency: 'RWF',
    msisdn: input.msisdn,
    network: input.network,
    bank: input.bank ?? null,
    beneficiaryName: input.beneficiaryName ?? null,
    narration: input.narration,
    callbackUrl: input.callbackUrl,
    status: 'pending',
    statusReason: null,
    // The bank's fees are the API's figures (GTBANK_COLLECTION_FEE_BPS and
    // GTBANK_DISBURSEMENT_FEE_RWF), never typed into a mock.
    fee: 0,
    createdAt: now,
    updatedAt: now,
    next: null,
    reversesAt: null,
    notified: [],
  };
}

function end(tx: Transaction, status: TransactionStatus, reason: string | null): void {
  tx.status = status;
  tx.statusReason = reason;
  tx.updatedAt = new Date().toISOString();
  tx.next = null;
}

/** How a payer's handset answers a prompt: its register row, else its last four digits. */
function behaviourOf(store: Store, msisdn: string): Behaviour {
  const wallet = store.wallet(msisdn);
  if (wallet) return wallet.behaviour;
  if (msisdn.endsWith('0000')) return 'decline';
  if (msisdn.endsWith('1111')) return 'slow';
  if (msisdn.endsWith('2222')) return 'insufficient_funds';
  if (msisdn.endsWith('7777')) return 'reverse';
  if (msisdn.endsWith('8888')) return 'hang';
  if (msisdn.endsWith('9999')) return 'late';
  return 'approve';
}

/** MTN numbers start 078 or 079, Airtel 072 or 073. */
function networkMatches(msisdn: string, network: 'MTN' | 'AIRTEL'): boolean {
  const prefix = msisdn.slice(4, 6);
  return network === 'MTN' ? prefix === '78' || prefix === '79' : prefix === '72' || prefix === '73';
}

function invalid(error: z.ZodError): HttpError {
  return new HttpError(400, {
    code: 'INVALID_REQUEST',
    message: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  });
}

function clientCredentials(request: Request): [string, string] {
  const auth = header(request, 'authorization') ?? '';
  const basic = /^Basic\s+(.+)$/i.exec(auth)?.[1];
  if (basic) {
    const decoded = Buffer.from(basic, 'base64').toString('utf8');
    const at = decoded.indexOf(':');
    if (at > 0) return [decoded.slice(0, at), decoded.slice(at + 1)];
  }
  const form = formOrJson(request);
  return [String(form.client_id ?? ''), String(form.client_secret ?? '')];
}

function grantType(request: Request): string {
  return String(formOrJson(request).grant_type ?? '');
}

function formOrJson(request: Request): Record<string, unknown> {
  const type = header(request, 'content-type') ?? '';
  const text = request.body.toString('utf8');
  if (type.includes('application/json')) {
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new HttpError(400, oauthError('The body is not valid JSON.'));
    }
  }
  return Object.fromEntries(new URLSearchParams(text));
}

function same(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function normalise(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}
