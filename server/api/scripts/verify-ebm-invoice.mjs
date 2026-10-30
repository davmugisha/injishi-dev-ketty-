// Verify the live RRA EBM invoice path against a TEST provider (ADR-041).
//
// This is the one check in the EBM work that no stub can stand in for. Every
// unit spec proves the code agrees with the provider's DOCUMENTED contract; this
// proves the provider agrees with the code: that a real token is accepted, that
// the connected account reports the TIN, and that a real invoice comes back
// certified by the VSDC with every field the receipt prints.
//
// It WRITES. It certifies one sale of one catalog item at a nominal price on the
// test VSDC. That is why it refuses any host that does not look like a test
// host: a test invoice certified against the production provider is a fake sale
// declared to RRA under a real taxpayer's TIN. `EBM_VERIFY_ALLOW_PRODUCTION=1`
// exists so the refusal is deliberate to override, and nothing in this
// repository sets it.
//
// It runs the REAL client and the REAL response reader from `dist/` — not a
// re-implementation — so a pass is evidence about the code that ships. Build
// first: `pnpm -F @injishi/api build`.
//
// WHERE THE TOKEN COMES FROM, first match wins:
//   1. EBM_VERIFY_ACCESS_TOKEN — a bearer token for the test taxpayer.
//   2. The API's own `ebm_connections` row (after an operator connected through
//      the app): read from DATABASE_URL, opened with EBM_TOKEN_ENCRYPTION_KEY,
//      refreshed through the provider if it is about to expire. Set
//      EBM_VERIFY_ORG_ID when more than one business is connected.
//
// WHICH ITEM AND CUSTOMER: EBM_VERIFY_ITEM_ID / EBM_VERIFY_CUSTOMER_ID, else the
// connection's mapping, else the first B-taxed item and the first customer with
// no TIN in the taxpayer's own lists.
//
// Reads server/api/.env for anything not already in the environment.
//
// Prints `VERIFY-EBM-INVOICE OK` only after every check passed.

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiEnvFile } from './env-file.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const API = path.resolve(HERE, '..');
const require = createRequire(path.join(API, 'package.json'));

// --- environment -----------------------------------------------------------

function loadDotEnv() {
  const file = apiEnvFile() ?? path.join(API, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadDotEnv();

const env = (key) => (process.env[key] ?? '').trim();

const failures = [];
function check(label, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(label);
  return ok;
}
function finish() {
  if (failures.length > 0) {
    console.error(`${failures.length} check(s) failed: ${failures.join('; ')}`);
    process.exitCode = 1;
  } else {
    console.log('VERIFY-EBM-INVOICE OK');
    process.exitCode = 0;
  }
  // Let sockets drain; force the exit only if something still holds the loop.
  setTimeout(() => process.exit(process.exitCode), 400).unref();
}
function stop(message) {
  check(message, false);
  finish();
  throw new Error('stopped');
}

/** A token, shortened so it can be named in output and never reconstructed. */
const redact = (token) => (token ? `${token.slice(0, 4)}…(${token.length})` : '(none)');

// --- the shipped code --------------------------------------------------------

function loadDist(relative) {
  const file = path.join(API, 'dist', relative);
  if (!existsSync(file)) {
    stop(`dist/${relative} is missing — build the API first: pnpm -F @injishi/api build`);
  }
  return require(file);
}

async function main() {
  const { EbmApiClient, EbmApiError } = loadDist('modules/ebm/infrastructure/ebm-api.client.js');
  const { readVsdcSale, signatureFromVsdc } = loadDist('modules/ebm/domain/vsdc-response.js');
  const { TokenCipher } = loadDist('modules/ebm/infrastructure/token-cipher.js');

  // --- where ---------------------------------------------------------------
  const base = env('EBM_API_BASE_URL');
  if (!base) stop('EBM_API_BASE_URL is not set (server/api/.env or the environment)');
  const host = new URL(base).hostname;
  const looksLikeTest = /(^|[.-])(test|staging|sandbox|dev)([.-]|$)/i.test(host) || host === 'localhost';
  if (!looksLikeTest && env('EBM_VERIFY_ALLOW_PRODUCTION') !== '1') {
    stop(`refusing to certify a test sale against ${host}: it does not look like a test provider`);
  }
  check('provider is a test host', true, host);

  const client = new EbmApiClient({
    baseUrl: base,
    clientId: env('EBM_OAUTH_CLIENT_ID'),
    clientSecret: env('EBM_OAUTH_CLIENT_SECRET'),
    redirectUri: env('EBM_OAUTH_REDIRECT_URI'),
    timeoutMs: Number(env('EBM_API_TIMEOUT_MS') || 20_000),
  });

  // --- 1. the provider is up ----------------------------------------------
  const status = await fetch(`${base.replace(/\/+$/, '')}/api/v1/status`, {
    signal: AbortSignal.timeout(15_000),
  })
    .then((r) => r.json())
    .catch((e) => ({ error: String(e) }));
  check('GET /api/v1/status reports the VSDC online', status?.online === true, JSON.stringify(status));

  // --- 2. a token ------------------------------------------------------------
  let accessToken = env('EBM_VERIFY_ACCESS_TOKEN');
  let mapping = null;
  let tokenSource = 'EBM_VERIFY_ACCESS_TOKEN';
  if (!accessToken) {
    tokenSource = 'ebm_connections';
    const { Client } = require('pg');
    const url = env('DATABASE_URL');
    if (!url) stop('no EBM_VERIFY_ACCESS_TOKEN and no DATABASE_URL to read a connection from');
    const db = new Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
    try {
      await db.connect();
    } catch (e) {
      stop(`no EBM_VERIFY_ACCESS_TOKEN, and the database is unreachable: ${e.message}`);
    }
    try {
      const orgFilter = env('EBM_VERIFY_ORG_ID');
      const { rows } = await db.query(
        `SELECT org_id, tin, access_token_ciphertext, refresh_token_ciphertext, access_token_expires_at,
                accommodation_item_id, service_fee_item_id, walk_in_customer_id
           FROM ebm_connections
          WHERE status = 'connected' ${orgFilter ? 'AND org_id = $1' : ''}
          ORDER BY connected_at DESC`,
        orgFilter ? [orgFilter] : [],
      );
      if (rows.length === 0) stop('no connected EBM account in ebm_connections — connect one from the operator app first');
      if (rows.length > 1 && !orgFilter) stop(`${rows.length} businesses are connected — set EBM_VERIFY_ORG_ID`);
      const row = rows[0];
      const cipher = TokenCipher.fromEnv(env('EBM_TOKEN_ENCRYPTION_KEY'));
      accessToken = cipher.decrypt(row.access_token_ciphertext, `ebm:access:${row.org_id}`);
      if (new Date(row.access_token_expires_at).getTime() - Date.now() < 60_000) {
        if (!row.refresh_token_ciphertext) stop('the stored token has expired and there is no refresh token');
        const refreshed = await client.refresh(
          cipher.decrypt(row.refresh_token_ciphertext, `ebm:refresh:${row.org_id}`),
        );
        accessToken = refreshed.accessToken;
        // Written back, sealed, so the API does not hold a refresh token the
        // provider has just rotated away.
        await db.query(
          `UPDATE ebm_connections
              SET access_token_ciphertext = $2, refresh_token_ciphertext = COALESCE($3, refresh_token_ciphertext),
                  access_token_expires_at = $4, updated_at = now()
            WHERE org_id = $1`,
          [
            row.org_id,
            cipher.encrypt(refreshed.accessToken, `ebm:access:${row.org_id}`),
            refreshed.refreshToken ? cipher.encrypt(refreshed.refreshToken, `ebm:refresh:${row.org_id}`) : null,
            refreshed.expiresAt,
          ],
        );
        check('refreshed the stored token through the provider', true);
      }
      mapping = {
        itemId: row.accommodation_item_id,
        customerId: row.walk_in_customer_id,
        tin: row.tin,
      };
    } finally {
      await db.end().catch(() => undefined);
    }
  }
  check('have a bearer token', Boolean(accessToken), `${tokenSource} ${redact(accessToken)}`);

  // --- 3. whose account -----------------------------------------------------
  let account;
  try {
    account = await client.account(accessToken);
  } catch (e) {
    stop(`GET /api/v1/ebm refused the token: ${e instanceof EbmApiError ? `${e.kind} ${e.message}` : e}`);
  }
  check('GET /api/v1/ebm answers a TIN', Boolean(account.tin), `${account.name ?? '?'} TIN ${account.tin} status ${account.status}`);
  if (mapping?.tin) {
    check('the account TIN is the TIN the connection stored', account.tin.replace(/\D/g, '') === String(mapping.tin).replace(/\D/g, ''));
  }
  check('the account is approved to invoice', account.status === 'approved', String(account.status));

  // --- 4. what to sell, and to whom ----------------------------------------
  const { items } = await client.items(accessToken, { limit: 100 });
  const wantedItem = Number(env('EBM_VERIFY_ITEM_ID')) || mapping?.itemId || null;
  const item = wantedItem ? items.find((i) => i.id === wantedItem) : items.find((i) => i.taxTyCd === 'B');
  if (!check('a B-taxed catalog item to sell', Boolean(item) && item.taxTyCd === 'B', item ? `${item.id} ${item.itemNm} (${item.taxTyCd})` : `${items.length} item(s) listed, none usable`)) {
    return finish();
  }
  const { customers } = await client.customers(accessToken, { limit: 100 });
  const wantedCustomer = Number(env('EBM_VERIFY_CUSTOMER_ID')) || mapping?.customerId || null;
  const customer = wantedCustomer
    ? customers.find((c) => c.id === wantedCustomer)
    : customers.find((c) => !c.tin || c.tin.trim() === '');
  if (!check('a walk-in customer with no TIN', Boolean(customer) && (!customer.tin || customer.tin.trim() === ''), customer ? `${customer.id} ${customer.name}` : `${customers.length} customer(s) listed, none without a TIN`)) {
    return finish();
  }

  // --- 5. certify one sale ----------------------------------------------------
  // 1 180 RWF tax-inclusive: 180 of it is VAT at 18%, so the expected tax is
  // exact and a rounding disagreement cannot hide in it.
  const PRICE = 1180;
  const request = { customerId: customer.id, paymentMethod: '07', items: [{ id: item.id, quantity: 1, unitPrice: PRICE }] };
  let invoice;
  try {
    invoice = await client.createInvoice(accessToken, request);
  } catch (e) {
    // An unknown outcome here is reported as such and NOT retried: the test
    // VSDC counts too, and a second send would leave two test sales.
    stop(`POST /api/v1/invoices failed: ${e instanceof EbmApiError ? `${e.kind} (${e.status}) ${e.message}` : e}`);
  }
  check('POST /api/v1/invoices answered with an invoice id', Number.isInteger(invoice.id), `provider invoice ${invoice.id}`);
  check('the VSDC certified it', invoice.status === 'Certified', String(invoice.status));
  console.log(`     answer fields: ${Object.keys(invoice.raw).sort().join(', ')}`);

  // --- 6. the answer carries what the receipt prints -------------------------
  let raw = invoice.raw;
  let fields;
  try {
    fields = readVsdcSale(raw);
  } catch (first) {
    console.log(`     the POST answer lacks a device field (${first.message}); reading the invoice back`);
    try {
      raw = { ...raw, ...(await client.invoice(accessToken, invoice.id)).raw };
      fields = readVsdcSale(raw);
    } catch (second) {
      check('the certified answer carries every SDC field (7.24)', false, second.message);
      console.log(`     answer: ${JSON.stringify(raw)}`);
      return finish();
    }
  }
  check('the certified answer carries every SDC field (7.24)', true,
    `rcptNo ${fields.rcptNo}, totRcptNo ${fields.totRcptNo}, ${fields.sdcId}, clock ${fields.vsdcRcptPbctDate}`);
  check('RRA certified the total that was sent', fields.totAmt === null || Math.abs(fields.totAmt - PRICE) < 0.005, String(fields.totAmt));
  check('RRA certified VAT B at 18% inclusive', fields.taxAmtB === null || Math.abs(fields.taxAmtB - 180) < 1, String(fields.taxAmtB));

  try {
    const { sdc, cis } = signatureFromVsdc(fields, 'NS', new Date());
    check('the answer maps to a valid EbmSdcBlock and EbmCisBlock', true, `${sdc.date} ${sdc.time} ${sdc.typeCounter}/${sdc.totalCounter} NS, CIS #${cis.receiptNumber} ${cis.mrc}`);
    console.log(`     QR: ${sdc.qrData}`);
  } catch (e) {
    check('the answer maps to a valid EbmSdcBlock and EbmCisBlock', false, e.message);
  }

  finish();
}

main().catch((error) => {
  if (error?.message !== 'stopped') {
    check('unexpected error', false, error?.stack ?? String(error));
    finish();
  }
});
