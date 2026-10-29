import {
  BROKER_PAY_METHOD_LABEL,
  type BrokerFeeCheckoutRequest,
  type BrokerFeePayment,
  type BrokerFeeQuote,
} from '@injishi/contracts';
import { ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import {
  PAYMENT_PORT,
  PaymentDeclinedError,
  PaymentUnavailableError,
  maskDestination,
  type PaymentPort,
} from '../../payments/domain/payment-port';

/** A prompt nobody answered in this long is given up on, as rent's are. */
const PROMPT_EXPIRES_MS = 10 * 60_000;

interface FeeRow {
  id: string;
  userId: string;
  brokerId: string | null;
  amountRwf: number;
  method: 'mtn_momo' | 'airtel_money';
  msisdnMasked: string | null;
  gatewayRef: string | null;
  status: 'pending' | 'paid' | 'failed';
  failureReason: string | null;
  idempotencyKey: string;
  paidAt: Date | null;
  createdAt: Date;
}

/**
 * The broker registration fee (2026-10-25: ID-verified registration, 5,000
 * RWF from `registration_fees`). Paid by mobile money BEFORE the broker row
 * exists: the wizard asks for the prompt, polls until it is approved, then
 * registers naming the paid payment, which `BrokerRegistrationService` ties
 * to the new broker in the same transaction. A number ending `0000` is
 * declined by the mock gateway, as everywhere.
 *
 * The gateway's workspace key is the person (`user:<id>`): a registrant has
 * no workspace yet, and the key only has to be the same on charge and read.
 */
@Injectable()
export class BrokerRegistrationFeeService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(PAYMENT_PORT) private readonly payments: PaymentPort,
  ) {}

  /** The clock, as a method so a test can pin it. */
  protected now(): Date {
    return new Date();
  }

  async quote(userId: string): Promise<BrokerFeeQuote> {
    const [amountRwf, paid] = await Promise.all([this.amount(), this.latestPaid(userId)]);
    return { amountRwf, paid: paid ? present(paid) : null };
  }

  /** Ask for the fee on the payer's phone. `clientKey` is the browser's one key per press. */
  async checkout(userId: string, body: BrokerFeeCheckoutRequest, clientKey: string): Promise<BrokerFeePayment> {
    if (await this.isBroker(userId)) throw new ConflictException({ code: 'already_broker', message: 'You are already registered as a broker.' });
    const key = `user:${userId}:broker-registration:${clientKey}`;
    const replay = await this.byKey(key);
    if (replay) {
      if (replay.userId !== userId) throw new ConflictException('That payment key was already used. Try again.');
      return present(await this.resolve(replay));
    }
    // Paid already and not yet used: no second charge.
    const paid = await this.latestPaid(userId);
    if (paid) return present(paid);

    const amountRwf = await this.amount();
    const msisdn = body.phone.replace(/^\+250/, '');
    const inserted = await this.db.execute<{ id: string }>(sql`
      insert into broker_registration_payments (user_id, amount_rwf, method, msisdn_masked, adapter_mode, idempotency_key)
      values (${userId}, ${amountRwf}, ${body.method}, ${maskDestination(`0${msisdn}`)}, ${this.payments.mode}, ${key})
      on conflict (idempotency_key) do nothing
      returning id
    `);
    const id = inserted.rows[0]?.id;
    const row = id ? await this.byId(id) : await this.byKey(key);
    if (!row) throw new Error('A registration fee payment vanished after it was written.');
    if (!id) return present(await this.resolve(row));

    try {
      const receipt = await this.payments.chargeOneTimeFee({
        kind: 'one_time_fee',
        purpose: 'registration_fee',
        feeCode: 'broker_registration',
        idempotencyKey: key,
        amountRwf,
        currency: 'RWF',
        workspaceId: gatewayWorkspace(userId),
        memo: 'Injishi broker registration',
        instrument: { kind: 'mobile_money', network: body.method, msisdn },
      });
      await this.db.execute(sql`update broker_registration_payments set gateway_ref = ${receipt.adapterRef}, updated_at = now() where id = ${row.id}`);
      if (receipt.settlement === 'settled') await this.markPaid(row.id);
    } catch (cause) {
      if (cause instanceof PaymentDeclinedError) {
        await this.fail(row.id, `The payment was declined: ${cause.reason}. Nothing was taken.`);
      } else if (cause instanceof PaymentUnavailableError) {
        await this.fail(row.id, 'The payment service did not answer. Nothing was taken.');
      } else {
        throw cause;
      }
    }
    return present(await this.resolve((await this.byId(row.id)) ?? row));
  }

  /** Where one fee payment stands, asking the gateway again while it waits. Another person's is not found. */
  async payment(userId: string, paymentId: string): Promise<BrokerFeePayment> {
    const row = await this.byId(paymentId);
    if (!row || row.userId !== userId) throw new NotFoundException('We could not find that payment.');
    return present(await this.resolve(row));
  }

  private async resolve(row: FeeRow): Promise<FeeRow> {
    if (row.status !== 'pending') return row;
    if (row.gatewayRef) {
      const receipt = await this.payments.fetchTransaction(gatewayWorkspace(row.userId), row.gatewayRef).catch(() => null);
      if (receipt?.settlement === 'settled') {
        await this.markPaid(row.id);
        return (await this.byId(row.id)) ?? row;
      }
    }
    if (this.now().getTime() - row.createdAt.getTime() > PROMPT_EXPIRES_MS) {
      await this.fail(row.id, 'The prompt on your phone expired before it was approved. Nothing was taken.');
      return (await this.byId(row.id)) ?? row;
    }
    return row;
  }

  private async markPaid(id: string): Promise<void> {
    await this.db.execute(sql`
      update broker_registration_payments set status = 'paid', paid_at = now(), updated_at = now()
       where id = ${id} and status = 'pending'
    `);
  }

  private async fail(id: string, reason: string): Promise<void> {
    await this.db.execute(sql`
      update broker_registration_payments set status = 'failed', failure_reason = ${reason}, updated_at = now()
       where id = ${id} and status = 'pending'
    `);
  }

  private async amount(): Promise<number> {
    const result = await this.db.execute<{ amount: string }>(sql`
      select amount_rwf::text as amount from registration_fees
       where business_type = 'broker' and active and effective_from <= now()
       order by effective_from desc limit 1
    `);
    const amount = Number(result.rows[0]?.amount ?? 0);
    if (!amount) throw new ServiceUnavailableException('The broker registration fee is not set yet. Try again later.');
    return amount;
  }

  private async isBroker(userId: string): Promise<boolean> {
    const result = await this.db.execute(sql`select 1 from brokers where user_id = ${userId}`);
    return result.rows.length > 0;
  }

  private async latestPaid(userId: string): Promise<FeeRow | null> {
    return this.one(sql`where user_id = ${userId} and status = 'paid' order by paid_at desc limit 1`);
  }

  private byId(id: string): Promise<FeeRow | null> {
    return this.one(sql`where id = ${id}`);
  }

  private byKey(key: string): Promise<FeeRow | null> {
    return this.one(sql`where idempotency_key = ${key}`);
  }

  private async one(where: ReturnType<typeof sql>): Promise<FeeRow | null> {
    const result = await this.db.execute<Record<string, unknown>>(sql`
      select id, user_id, broker_id, amount_rwf, method::text as method, msisdn_masked, gateway_ref, status::text as status,
             failure_reason, idempotency_key, paid_at, created_at
        from broker_registration_payments ${where}
    `);
    const r = result.rows[0];
    if (!r) return null;
    return {
      id: r.id as string,
      userId: r.user_id as string,
      brokerId: (r.broker_id as string | null) ?? null,
      amountRwf: Number(r.amount_rwf),
      method: r.method as FeeRow['method'],
      msisdnMasked: (r.msisdn_masked as string | null) ?? null,
      gatewayRef: (r.gateway_ref as string | null) ?? null,
      status: r.status as FeeRow['status'],
      failureReason: (r.failure_reason as string | null) ?? null,
      idempotencyKey: r.idempotency_key as string,
      paidAt: r.paid_at ? new Date(r.paid_at as string) : null,
      createdAt: new Date(r.created_at as string),
    };
  }
}

function gatewayWorkspace(userId: string): string {
  return `user:${userId}`;
}

function present(row: FeeRow): BrokerFeePayment {
  const label = BROKER_PAY_METHOD_LABEL[row.method];
  return {
    id: row.id,
    amountRwf: row.amountRwf,
    method: row.method,
    methodWords: row.msisdnMasked ? `${label} ${row.msisdnMasked}` : label,
    status: row.status,
    failureReason: row.failureReason,
    paidAt: row.paidAt?.toISOString() ?? null,
  };
}
