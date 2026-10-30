import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { generatedCitizen, generatedTaxpayer } from './registers/generated.ts';
import {
  type Citizen,
  type Passport,
  REGISTER_NAMES,
  REGISTER_SCHEMAS,
  type RegisterName,
  type Registers,
  type Taxpayer,
  type Wallet,
  keyOf,
} from './registers/schemas.ts';

/**
 * What the mock providers know: the seeded registers, the rows added through
 * the console, and the runtime state (payments, Smile ID jobs, tokens).
 *
 * Seeds are read from `seed/*.json` at boot and are never written. Rows added
 * later, and every payment and job, live in `<dataDir>/state.json`, written
 * after each change, so a restart of the mock server does not lose a prompt a
 * registrant is waiting on. `MOCK_APIS_DATA_DIR=memory` keeps all of it in
 * memory, which is what the tests do.
 */

const SEED_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed');

export type TransactionStatus = 'pending' | 'successful' | 'failed' | 'rejected' | 'reversed' | 'refunded' | 'cancelled';

export interface Transaction {
  transactionReference: string;
  clientReference: string;
  type: 'collection' | 'disbursement';
  amount: number;
  currency: 'RWF';
  /** The wallet prompted (a collection) or paid (a disbursement to a wallet). */
  msisdn: string | null;
  network: 'MTN' | 'AIRTEL' | null;
  /** A disbursement to a bank account. */
  bank: { bankCode: string; accountNumber: string } | null;
  beneficiaryName: string | null;
  narration: string | null;
  callbackUrl: string | null;
  status: TransactionStatus;
  statusReason: string | null;
  fee: number;
  createdAt: string;
  updatedAt: string;
  /**
   * What a pending transaction becomes by itself, and when: the handset
   * approving or declining, the wallet failing. Null waits for the console.
   */
  next: { status: TransactionStatus; at: string; reason: string | null } | null;
  /** When a successful transaction is reversed by itself. */
  reversesAt: string | null;
  /** The callbacks already sent, by status, so each is sent once. */
  notified: TransactionStatus[];
}

export interface SmileJob {
  partnerId: string;
  userId: string;
  jobId: string;
  smileJobId: string;
  /** Set once the upload arrives. */
  uploadedAt: string | null;
  completesAt: string | null;
  result: Record<string, unknown> | null;
  callbackUrl: string | null;
  createdAt: string;
}

interface State {
  added: Registers;
  transactions: Transaction[];
  smileJobs: SmileJob[];
}

function emptyRegisters(): Registers {
  return { citizens: [], taxpayers: [], passports: [], wallets: [] };
}

function readSeed<T>(name: RegisterName): T[] {
  const file = path.join(SEED_DIR, `${name}.json`);
  const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));
  const parsed = z.array(REGISTER_SCHEMAS[name]).safeParse(raw);
  if (!parsed.success) {
    throw new Error(`seed/${name}.json does not read: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
  }
  return parsed.data as T[];
}

export class Store {
  readonly seeds: Registers;
  private state: State;
  private readonly file: string | null;

  constructor(dataDir: string | null) {
    this.seeds = {
      citizens: readSeed<Citizen>('citizens'),
      taxpayers: readSeed<Taxpayer>('taxpayers'),
      passports: readSeed<Passport>('passports'),
      wallets: readSeed<Wallet>('wallets'),
    };
    this.file = dataDir ? path.join(dataDir, 'state.json') : null;
    this.state = { added: emptyRegisters(), transactions: [], smileJobs: [] };
    if (this.file && existsSync(this.file)) {
      try {
        const loaded = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<State>;
        this.state = {
          added: { ...emptyRegisters(), ...(loaded.added ?? {}) },
          transactions: loaded.transactions ?? [],
          smileJobs: loaded.smileJobs ?? [],
        };
      } catch (error) {
        // A state file that does not read is set aside rather than trusted or
        // silently overwritten, so whoever broke it can still look at it.
        const aside = `${this.file}.unreadable-${Date.now()}`;
        renameSync(this.file, aside);
        console.warn(`[mock-apis] ${this.file} did not read (${(error as Error).message}); moved to ${aside}.`);
      }
    }
  }

  // --- Registers ----------------------------------------------------------

  /** Every row of a register: added rows win over seeds with the same key. */
  rows<N extends RegisterName>(name: N): Registers[N] {
    const added = this.state.added[name] as Registers[N];
    const keys = new Set(added.map((row) => keyOf(name, row)));
    const seeded = (this.seeds[name] as Registers[N]).filter((row) => !keys.has(keyOf(name, row)));
    return [...added, ...seeded] as Registers[N];
  }

  /** Add or replace one row. The caller has validated it. */
  put(name: RegisterName, row: Citizen | Taxpayer | Passport | Wallet): void {
    const key = keyOf(name, row);
    const list = this.state.added[name] as Array<typeof row>;
    const index = list.findIndex((existing) => keyOf(name, existing) === key);
    if (index >= 0) list[index] = row;
    else list.unshift(row);
    this.save();
  }

  citizen(nationalId: string): Citizen | null {
    return this.rows('citizens').find((c) => c.nationalId === nationalId) ?? generatedCitizen(nationalId);
  }

  taxpayer(tin: string): Taxpayer | null {
    return this.rows('taxpayers').find((t) => t.tin === tin) ?? generatedTaxpayer(tin, (id) => this.citizen(id));
  }

  passport(number: string): Passport | null {
    const key = number.trim().toUpperCase();
    return this.rows('passports').find((p) => p.passportNumber.toUpperCase() === key) ?? null;
  }

  wallet(msisdn: string): Wallet | null {
    return this.rows('wallets').find((w) => w.msisdn === msisdn) ?? null;
  }

  // --- Payments -----------------------------------------------------------

  transactions(): readonly Transaction[] {
    return this.state.transactions;
  }

  findTransaction(reference: string): Transaction | null {
    return this.state.transactions.find((t) => t.transactionReference === reference) ?? null;
  }

  findByClientReference(type: Transaction['type'], clientReference: string): Transaction | null {
    return this.state.transactions.find((t) => t.type === type && t.clientReference === clientReference) ?? null;
  }

  addTransaction(transaction: Transaction): void {
    this.state.transactions.unshift(transaction);
    // A laptop's mock never needs more than the recent history.
    if (this.state.transactions.length > 2_000) this.state.transactions.length = 2_000;
    this.save();
  }

  // --- Smile ID -----------------------------------------------------------

  smileJob(partnerId: string, userId: string, jobId: string): SmileJob | null {
    return (
      this.state.smileJobs.find((j) => j.partnerId === partnerId && j.userId === userId && j.jobId === jobId) ?? null
    );
  }

  smileJobBySmileId(smileJobId: string): SmileJob | null {
    return this.state.smileJobs.find((j) => j.smileJobId === smileJobId) ?? null;
  }

  addSmileJob(job: SmileJob): void {
    this.state.smileJobs.unshift(job);
    if (this.state.smileJobs.length > 500) this.state.smileJobs.length = 500;
    this.save();
  }

  // --- Lifecycle ----------------------------------------------------------

  /** Forget everything added since boot: runtime state and console rows. Seeds stay. */
  reset(): void {
    this.state = { added: emptyRegisters(), transactions: [], smileJobs: [] };
    this.save();
  }

  /** Write the state file, if there is one. Called after every change. */
  save(): void {
    if (!this.file) return;
    mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.tmp`;
    writeFileSync(temp, JSON.stringify(this.state, null, 2));
    renameSync(temp, this.file);
  }
}

export { REGISTER_NAMES };
