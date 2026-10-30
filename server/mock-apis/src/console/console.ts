import { z } from 'zod';

import { type MockApisConfig, SERVICE_NAME } from '../config.ts';
import { HttpError, type Reply, type Request, type Router, header, json } from '../http.ts';
import { advance, decide, present } from '../providers/gtbank.ts';
import { REGISTER_NAMES, REGISTER_SCHEMAS, type RegisterName } from '../registers/schemas.ts';
import type { Store, Transaction } from '../store.ts';
import { nationalIdFront, passportPhotoPage, selfie } from './demo-images.ts';

/**
 * The console: what a tester reads and presses while walking a registration.
 *
 * `GET /` is one page: how to point the API here, every seeded row with the
 * demo images to upload for it, the rules for numbers with no row, and the
 * payments with Approve and Decline buttons (the handset nobody is holding).
 * `/__mock/*` is the same as JSON, plus adding rows and resetting.
 *
 * The page is plain HTML with system colours (`Canvas`, `GrayText`, ...), so
 * it follows the light or dark setting and needs no palette.
 */

const PNG = { 'content-type': 'image/png' };

export function registerConsole(router: Router, store: Store, config: MockApisConfig): void {
  router.on('GET', '/__mock/health', () => ({
    status: 200,
    body: {
      service: SERVICE_NAME,
      ok: true,
      providers: {
        gtbank: `${config.publicUrl}/gtbank`,
        rra: `${config.publicUrl}/rra`,
        smileId: `${config.publicUrl}/smile-id`,
      },
    },
  }));

  router.on('GET', '/__mock/registers', () => ({
    status: 200,
    body: Object.fromEntries(REGISTER_NAMES.map((name) => [name, store.rows(name)])),
  }));

  router.on('POST', '/__mock/registers/:register', (request) => {
    const name = request.params.register as RegisterName;
    if (!(REGISTER_NAMES as readonly string[]).includes(name)) {
      throw new HttpError(404, { error: `No register named ${name}. Use one of ${REGISTER_NAMES.join(', ')}.` });
    }
    const parsed = REGISTER_SCHEMAS[name].safeParse(json(request, (m) => ({ error: m })));
    if (!parsed.success) {
      throw new HttpError(422, { error: 'That row does not read.', issues: parsed.error.issues });
    }
    store.put(name, parsed.data);
    return { status: 201, body: parsed.data };
  });

  router.on('GET', '/__mock/transactions', () => {
    for (const tx of store.transactions()) advance(store, tx);
    return { status: 200, body: { items: store.transactions().map(present) } };
  });

  router.on('POST', '/__mock/transactions/:reference/:decision', (request) => {
    const decision = z.enum(['approve', 'decline', 'reverse']).safeParse(request.params.decision);
    if (!decision.success) throw new HttpError(404, { error: 'Approve, decline or reverse.' });
    const tx = store.findTransaction(request.params.reference!);
    if (!tx) throw new HttpError(404, { error: 'No transaction has this reference.' });
    decide(store, tx, decision.data);
    return fromForm(request) ? back() : { status: 200, body: present(tx) };
  });

  router.on('POST', '/__mock/reset', (request) => {
    store.reset();
    return fromForm(request) ? back() : { status: 200, body: { reset: true } };
  });

  router.on('GET', '/__mock/documents/citizens/:nationalId/card.png', (request) => ({
    status: 200,
    headers: PNG,
    body: nationalIdFront(digits(request.params.nationalId!, 16)),
  }));
  router.on('GET', '/__mock/documents/citizens/:nationalId/selfie.png', (request) => ({
    status: 200,
    headers: PNG,
    body: selfie(digits(request.params.nationalId!, 16)),
  }));
  router.on('GET', '/__mock/documents/passports/:number/photo-page.png', (request) => ({
    status: 200,
    headers: PNG,
    body: passportPhotoPage(passportNumber(request.params.number!)),
  }));
  router.on('GET', '/__mock/documents/passports/:number/selfie.png', (request) => ({
    status: 200,
    headers: PNG,
    body: selfie(passportNumber(request.params.number!)),
  }));

  router.on('GET', '/', () => {
    for (const tx of store.transactions()) advance(store, tx);
    return { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body: page(store, config) };
  });
}

function digits(value: string, length: number): string {
  if (!new RegExp(`^\\d{${length}}$`).test(value)) throw new HttpError(400, { error: `Expected ${length} digits.` });
  return value;
}

function passportNumber(value: string): string {
  const upper = value.toUpperCase();
  if (!/^[A-Z0-9]{5,20}$/.test(upper)) throw new HttpError(400, { error: 'A passport number is 5 to 20 letters and digits.' });
  return upper;
}

function fromForm(request: Request): boolean {
  return (header(request, 'content-type') ?? '').includes('application/x-www-form-urlencoded');
}

function back(): Reply {
  return { status: 303, headers: { location: '/#payments' } };
}

// --- The page --------------------------------------------------------------

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function table(head: string[], rows: string[][]): string {
  return `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

function link(href: string, label: string): string {
  return `<a href="${esc(href)}" download>${esc(label)}</a>`;
}

function payments(transactions: readonly Transaction[]): string {
  if (transactions.length === 0) return '<p class="quiet">No payments yet. A registration fee prompt appears here.</p>';
  const rows = transactions.slice(0, 40).map((tx) => {
    const who = tx.type === 'collection' ? `${tx.msisdn} (${tx.network})` : (tx.beneficiaryName ?? '');
    const actions =
      tx.status === 'pending'
        ? `${button(tx, 'approve', 'Approve')} ${button(tx, 'decline', 'Decline')}`
        : tx.status === 'successful'
          ? button(tx, 'reverse', 'Reverse')
          : '';
    return [
      esc(tx.createdAt.slice(11, 19)),
      esc(tx.type),
      esc(who),
      `${esc(tx.amount.toLocaleString('en-RW'))} RWF`,
      `<strong>${esc(tx.status)}</strong>${tx.statusReason ? ` <span class="quiet">${esc(tx.statusReason)}</span>` : ''}`,
      `<code>${esc(tx.clientReference)}</code>`,
      actions,
    ];
  });
  return table(['Time (UTC)', 'Type', 'Payer or payee', 'Amount', 'Status', 'Client reference', ''], rows);
}

function button(tx: Transaction, decision: string, label: string): string {
  return `<form method="post" action="/__mock/transactions/${esc(tx.transactionReference)}/${decision}"><button>${esc(label)}</button></form>`;
}

function page(store: Store, config: MockApisConfig): string {
  const pending = store.transactions().some((t) => t.status === 'pending');
  const citizens = store.rows('citizens').map((c) => [
    `<code>${esc(c.nationalId)}</code>`,
    esc(`${c.foreNames} ${c.surname}`),
    esc(c.dateOfBirth),
    esc(c.scenario),
    esc(c.note ?? ''),
    `${link(`/__mock/documents/citizens/${c.nationalId}/selfie.png`, 'selfie')} · ${link(`/__mock/documents/citizens/${c.nationalId}/card.png`, 'card')}`,
  ]);
  const taxpayers = store.rows('taxpayers').map((t) => [
    `<code>${esc(t.tin)}</code>`,
    esc(t.taxpayerName),
    esc(t.directors.map((d) => `${d.fullName} (${d.nationalId ?? d.passportNumber})`).join(', ') || '—'),
    esc(t.scenario),
    esc(t.note ?? ''),
  ]);
  const passports = store.rows('passports').map((p) => [
    `<code>${esc(p.passportNumber)}</code>`,
    esc(p.fullName),
    esc(p.country),
    esc(p.expiresOn),
    esc(p.scenario),
    esc(p.note ?? ''),
    `${link(`/__mock/documents/passports/${p.passportNumber}/photo-page.png`, 'photo page')} · ${link(`/__mock/documents/passports/${p.passportNumber}/selfie.png`, 'selfie')}`,
  ]);
  const wallets = store.rows('wallets').map((w) => [
    `<code>${esc(w.msisdn)}</code>`,
    esc(w.network),
    esc(w.holderName),
    esc(w.behaviour),
    esc(w.note ?? ''),
  ]);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${pending ? '<meta http-equiv="refresh" content="5">' : ''}
<title>Injishi Mock APIs</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; line-height: 1.45; }
  body { margin: 0 auto; padding: 24px; max-width: 1200px; background: Canvas; color: CanvasText; }
  h1 { margin-bottom: 4px; } h2 { margin-top: 40px; }
  .quiet { color: GrayText; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { text-align: left; vertical-align: top; padding: 6px 8px; border-bottom: 1px solid GrayText; }
  code, pre { font-family: ui-monospace, monospace; font-size: 13px; }
  pre { padding: 12px; border: 1px solid GrayText; overflow-x: auto; }
  form { display: inline; }
  li { margin-bottom: 4px; }
</style>
</head>
<body>
<h1>Injishi Mock APIs</h1>
<p class="quiet">Stand-ins for GTBank (NIDA gateway and Payment Hub), RRA (taxpayer register) and Smile ID (document check). Every person, number and business here is fictional. Laptops and sample databases only.</p>

<h2>Point the API here</h2>
<p>Add these to <code>server/api/.env</code>, then restart the API. Each seam is switched on its own: leave one on <code>mock</code> to keep its in-process stand-in.</p>
<pre>MOCK_APIS_URL=${esc(config.publicUrl)}
MOCK_APIS_SECRET=${esc(config.secret)}
RRA_TIN_ADAPTER_MODE=sandbox
NIDA_ADAPTER_MODE=sandbox
DOCUMENT_VERIFIER_MODE=sandbox
PAYMENT_ADAPTER_MODE=sandbox</pre>

<h2 id="payments">Payments</h2>
<p class="quiet">Request to Pay prompts and payouts sent to GTBank's Payment Hub. ${pending ? 'This page refreshes every 5 seconds while a prompt is pending.' : ''}</p>
${payments(store.transactions())}
<form method="post" action="/__mock/reset"><button>Reset payments, jobs and added rows</button></form>

<h2>Citizens (NIDA, through GTBank)</h2>
<p class="quiet">On the You step, type the National ID and upload its <em>selfie</em>. A selfie downloaded for someone else fails the face match.</p>
${table(['National ID', 'Name', 'Born', 'Scenario', 'Note', 'Demo images'], citizens)}

<h2>Taxpayers (RRA)</h2>
${table(['TIN', 'Registered name', 'Directors', 'Scenario', 'Note'], taxpayers)}

<h2>Passports (Smile ID)</h2>
<p class="quiet">On the You step, choose Passport and upload the <em>photo page</em>, then the <em>selfie</em>.</p>
${table(['Passport', 'Name', 'Country', 'Expires', 'Scenario', 'Note', 'Demo images'], passports)}

<h2>Wallets (GTBank Payment Hub)</h2>
<p class="quiet">Pay the registration fee from one of these numbers.</p>
${table(['Number', 'Network', 'Holder', 'Behaviour', 'Note'], wallets)}

<h2>Numbers with no row</h2>
<ul>
  <li>National ID: any sixteen digits <code>1YYYY</code> + <code>7</code> (female) or <code>8</code> (male) + seven + three digits is a made up citizen. A sequence (digits 7 to 13) of <code>0000000</code> is not found; <code>9999999</code> means the gateway is down.</li>
  <li>TIN: <code>9981NNNNN</code> has one director, National ID <code>11990800NNNNN101</code>. <code>9982NNNNN</code> has two, <code>11990801NNNNN101</code> and <code>11992702NNNNN101</code>. Any other TIN is not registered.</li>
  <li>Passport photo page from a camera: a made up holder, verified. A selfie from a camera matches.</li>
  <li>Mobile money, by the last four digits: <code>0000</code> declines, <code>1111</code> approves after a minute, <code>2222</code> lacks funds, <code>7777</code> is paid then reversed, <code>8888</code> never answers, <code>9999</code> approves after the prompt window. Anything else approves in a few seconds.</li>
</ul>

<h2>Add a row</h2>
<p>POST JSON to <code>/__mock/registers/{${REGISTER_NAMES.join('|')}}</code>, in the shape of <code>server/mock-apis/seed/*.json</code>. A row with a known key replaces it. Added rows live in the data folder until reset.</p>
</body>
</html>`;
}
