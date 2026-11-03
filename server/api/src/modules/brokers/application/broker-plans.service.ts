import {
  BROKER_PAY_METHOD_LABEL,
  BROKER_PLAN_GRACE_DAYS,
  brokerAreaLabel,
  kigaliToday,
  longDate,
  provinceLabel,
  type BrokerHomeDistrictRequest,
  type BrokerPayMethod,
  type BrokerPlanChangeRequest,
  type BrokerPlanCheckoutRequest,
  type BrokerPlanCode,
  type BrokerPlanOverview,
  type BrokerPlanPayment,
  type BrokerScope,
  type WorkspaceAccess,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  PAYMENT_PORT,
  PaymentDeclinedError,
  PaymentUnavailableError,
  maskDestination,
  type PaymentPort,
  type SubscriptionChargeCommand,
} from '../../pay/domain/payment-port';
import {
  addDays,
  addMonth,
  districtChangeFrom,
  effectiveScope,
  graceUntil,
  periodProblem,
  upgradeCharge,
  type EffectiveScope,
  type LivePlan,
} from '../domain/broker-plan-rules';
import { RentalsMailer } from '../../rentals/infrastructure/rentals.mailer';
import { BrokersRepository, type BrokerSelfRow } from '../infrastructure/brokers.repository';
import {
  BrokerPlansRepository,
  type PaymentRow,
  type PlanRow,
  type RenewalRow,
  type SubscriptionRow,
} from '../infrastructure/broker-plans.repository';

/** A day as people say it: "25 October 2026". */
const dayWords = longDate;
/** The broker's plan page in the app. */
const PLAN_PATH = '/broker/plan';

/** A prompt nobody answered in this long is given up on, as rent's are. */
const PROMPT_EXPIRES_MS = 10 * 60_000;
/** A card page left this long is given up on. */
const CHECKOUT_EXPIRES_MS = 60 * 60_000;
const SWEEP_CONCURRENCY = 5;
const RWF = new Intl.NumberFormat('en-US');

/**
 * Broker plans (2026-10-23): District is free, Province and Country are paid
 * by the month through the gateway.
 *
 * The plan decides what every broker list shows (`scopeFor`); the money
 * decides the plan. An upgrade is a waiting subscription until its payment
 * lands, so a decline leaves the broker where they were. Renewals run from
 * the hourly BrokerPlans job: a prompt to the number that paid last, or the card
 * the gateway saved. A renewal that fails leaves three days' grace, then the
 * broker is back on District. Nothing is deleted; only what is shown narrows.
 *
 * No `@RequirePermission`, for the reason `BrokerService` gives: a broker
 * workspace holds no permissions, and this service resolves the broker from
 * the workspace and refuses anything else.
 */
@Injectable()
export class BrokerPlansService {
  private readonly logger = new Logger(BrokerPlansService.name);
  private readonly paymentMode: 'mock' | 'live' | 'off';

  constructor(
    private readonly repo: BrokerPlansRepository,
    private readonly brokers: BrokersRepository,
    @Inject(PAYMENT_PORT) private readonly payments: PaymentPort,
    @Optional() private readonly mailer?: RentalsMailer,
    @Optional() config?: ConfigService,
  ) {
    const configured = (config?.get<string>('PAYMENT_ADAPTER_MODE') ?? 'mock').trim();
    this.paymentMode = configured === 'off' ? 'off' : configured === 'live' ? 'live' : 'mock';
  }

  /** The clock, as a method so a test can pin it. */
  protected now(): Date {
    return new Date();
  }

  // --- What a broker sees ------------------------------------------------------

  /** The plan in force today, cut to what the lists filter on. */
  async scopeFor(brokerId: string): Promise<EffectiveScope> {
    const [live, home] = await Promise.all([this.repo.live(brokerId), this.repo.home(brokerId)]);
    return effectiveScope(liveOf(live), home.districtId, kigaliToday(this.now()));
  }

  /** The scope in words, with the next plan up, for the note on the lists. */
  async describeScope(brokerId: string, scope?: EffectiveScope): Promise<BrokerScope> {
    const [home, plans, provinces] = await Promise.all([this.repo.home(brokerId), this.repo.plans(), this.repo.provinces()]);
    const s = scope ?? (await this.scopeFor(brokerId));
    const provinceName = (id: number | null): string | null => provinces.find((p) => p.id === id)?.name ?? null;
    const provinceId = s.plan === 'province' ? s.provinceId : home.provinceId;
    const area = brokerAreaLabel(s.plan, {
      district: home.districtName,
      province: provinceName(s.plan === 'province' ? s.provinceId : null),
    });
    const offered = (code: BrokerPlanCode): PlanRow | null => plans.find((p) => p.code === code && p.active && p.priceRwf > 0) ?? null;
    const next = s.plan === 'district' ? (offered('province') ?? offered('country')) : s.plan === 'province' ? offered('country') : null;
    return {
      plan: s.plan,
      area,
      districtId: s.plan === 'district' ? s.districtId : null,
      provinceId: s.plan === 'country' ? null : provinceId,
      needsDistrict: s.plan === 'district' && s.districtId === null,
      upgrade: next
        ? {
            plan: next.code,
            area: brokerAreaLabel(next.code, { province: provinceName(home.provinceId) }),
            priceRwf: next.priceRwf,
          }
        : null,
    };
  }

  // --- The Plan page -----------------------------------------------------------

  async overview(ws: WorkspaceAccess): Promise<BrokerPlanOverview> {
    const broker = await this.brokerOf(ws);
    const today = kigaliToday(this.now());
    // A payment waiting on a phone is asked about first, so the page is current.
    const waiting = (await this.repo.payments(broker.id)).filter((p) => p.status === 'pending');
    await Promise.all(waiting.map((p) => this.resolve(p)));

    const [plans, home, live, payments, provinces] = await Promise.all([
      this.repo.plans(),
      this.repo.home(broker.id),
      this.repo.live(broker.id),
      this.repo.payments(broker.id),
      this.repo.provinces(),
    ]);
    const scope = effectiveScope(liveOf(live), home.districtId, today);
    const inForce = scope.plan !== 'district' ? live : null;
    const area = brokerAreaLabel(scope.plan, {
      district: home.districtName,
      province: inForce?.provinceName ?? null,
    });
    const nextPlan = inForce?.nextPlanCode ? plans.find((p) => p.code === inForce.nextPlanCode) ?? null : null;
    const endsInto: BrokerPlanCode | null = inForce?.cancelAtPeriodEnd ? 'district' : (nextPlan?.code ?? null);
    const pending = payments.find((p) => p.status === 'pending') ?? null;

    return {
      plans: plans.filter((p) => p.active).map((p) => ({ code: p.code, name: p.name, priceRwf: p.priceRwf, active: p.active, sort: p.sort })),
      home: {
        districtId: home.districtId,
        districtName: home.districtName,
        provinceId: home.provinceId,
        provinceName: home.provinceName ? provinceLabel(home.provinceName) : null,
        // Only the free plan is held to one move a month.
        changeFrom: scope.plan === 'district' ? districtChangeFrom(home.changedAt, this.now(), kigaliToday) : null,
      },
      current: inForce
        ? {
            plan: inForce.planCode,
            status: inForce.status,
            area,
            provinceId: inForce.provinceId,
            periodStart: inForce.periodStart,
            periodEnd: inForce.periodEnd,
            nextPaymentOn: inForce.cancelAtPeriodEnd ? null : inForce.periodEnd,
            nextAmountRwf: inForce.cancelAtPeriodEnd ? null : (nextPlan?.priceRwf ?? planPrice(plans, inForce.planCode)),
            endsInto,
            graceUntil: inForce.status === 'past_due' ? graceUntil(inForce.periodEnd) : null,
            method: inForce.payMethod,
          }
        : {
            plan: 'district',
            status: 'active',
            area,
            provinceId: null,
            periodStart: null,
            periodEnd: null,
            nextPaymentOn: null,
            nextAmountRwf: null,
            endsInto: null,
            graceUntil: null,
            method: null,
          },
      quotes: plans
        .filter((p) => p.active && p.priceRwf > 0)
        .map((p) => ({
          plan: p.code,
          amountRwf:
            inForce && inForce.planCode === p.code && inForce.status === 'past_due'
              ? p.priceRwf
              : upgradeCharge(
                  p.priceRwf,
                  inForce
                    ? { priceRwf: inForce.planPriceRwf, periodStart: inForce.periodStart, periodEnd: inForce.periodEnd, status: inForce.status === 'past_due' ? 'past_due' : 'active' }
                    : null,
                  today,
                ),
        })),
      pending: pending ? present(pending) : null,
      payments: payments.map(present),
      provinces: provinces.map((p) => ({ id: p.id, name: p.name, label: provinceLabel(p.name) })),
    };
  }

  /**
   * Pay for a plan: an upgrade, or a past-due month. The plan changes only
   * when the money lands. `clientKey` is the browser's one key per press, so
   * a retry is the same payment.
   */
  async checkout(ws: WorkspaceAccess, body: BrokerPlanCheckoutRequest, clientKey: string): Promise<BrokerPlanPayment> {
    const broker = await this.brokerOf(ws);
    this.assertActive(broker);
    const key = `${ws.workspaceId}:subscription_charge:${clientKey}`;
    const replay = await this.repo.paymentByKey(key);
    if (replay) {
      if (replay.brokerId !== broker.id || replay.planCode !== body.plan) {
        throw new ConflictException('That payment key was already used for a different payment. Try again.');
      }
      return present(await this.resolve(replay));
    }
    if (this.paymentMode === 'off') {
      throw new ServiceUnavailableException("Paying for a plan isn't available yet.");
    }

    const today = kigaliToday(this.now());
    const plan = await this.repo.plan(body.plan);
    if (!plan || !plan.active || plan.priceRwf <= 0) throw new ConflictException('That plan is not offered right now.');
    const home = await this.repo.home(broker.id);
    const provinceId = plan.code === 'province' ? (body.provinceId ?? home.provinceId) : null;
    if (plan.code === 'province') {
      if (provinceId === null) throw new BadRequestException('Choose a province.');
      if (!(await this.repo.province(provinceId))) throw new BadRequestException('Choose a province from the list.');
    }

    await this.clearLapsedStart(broker.id);
    const live = await this.repo.live(broker.id);
    const msisdn = body.method === 'card' || !body.phone ? null : body.phone.replace(/^\+250/, '');

    let subscriptionId: string;
    let kind: 'start' | 'renewal';
    let periodStart: string;
    let amountRwf: number;
    const samePlan = live !== null && live.planCode === plan.code && (plan.code === 'country' || live.provinceId === provinceId);
    if (live && samePlan) {
      if (live.status !== 'past_due') throw new ConflictException('You are already on this plan.');
      // A month that did not renew, paid now: it runs from where the last one ended.
      subscriptionId = live.id;
      kind = 'renewal';
      periodStart = live.periodEnd;
      amountRwf = plan.priceRwf;
      await this.repo.setPayMethod(live.id, body.method, msisdn);
    } else {
      if (live && live.status === 'active' && plan.priceRwf <= live.planPriceRwf) {
        throw new ConflictException(
          live.planCode === plan.code
            ? 'Change the province under Change plan. It takes effect at once.'
            : 'A cheaper plan starts when this month ends. Choose it under Change plan.',
        );
      }
      kind = 'start';
      periodStart = today;
      amountRwf = upgradeCharge(
        plan.priceRwf,
        live ? { priceRwf: live.planPriceRwf, periodStart: live.periodStart, periodEnd: live.periodEnd, status: live.status === 'past_due' ? 'past_due' : 'active' } : null,
        today,
      );
      const id = await this.repo.insertPendingStart({
        brokerId: broker.id,
        planId: plan.id,
        provinceId,
        periodStart,
        periodEnd: addMonth(periodStart),
        method: body.method,
        msisdn,
      });
      if (!id) throw new ConflictException('A payment for a plan is already waiting. Approve or decline it first.');
      subscriptionId = id;
    }
    const periodEnd = addMonth(periodStart);
    const problem = periodProblem(periodStart, periodEnd, kind === 'renewal' ? periodStart : today);
    if (problem) throw new BadRequestException(problem);

    const paymentId = await this.repo.insertPayment({
      subscriptionId,
      brokerId: broker.id,
      planId: plan.id,
      kind,
      periodStart,
      periodEnd,
      amountRwf,
      method: body.method,
      msisdnMasked: msisdn ? maskDestination(`0${msisdn}`) : null,
      adapterMode: this.payments.mode,
      idempotencyKey: key,
    });
    const row = paymentId ? await this.repo.payment(paymentId) : await this.repo.paymentByKey(key);
    if (!row) throw new Error('A plan payment vanished after it was written.');
    if (!paymentId) return present(await this.resolve(row));

    const instrument: SubscriptionChargeCommand['instrument'] =
      body.method === 'card'
        ? { kind: 'card_checkout', returnUrl: this.returnUrl(ws.workspaceId, row.id) }
        : { kind: 'mobile_money', network: body.method, msisdn: msisdn as string };
    await this.charge(row, ws.workspaceId, instrument);
    const after = (await this.repo.payment(row.id)) ?? row;
    // A card payment goes to the gateway's page first; asking now would ask before the payer has been there.
    return present(body.method === 'card' ? after : await this.resolve(after));
  }

  /** Where one payment stands, asking the gateway again if it is waiting. */
  async payment(ws: WorkspaceAccess, paymentId: string): Promise<BrokerPlanPayment> {
    const broker = await this.brokerOf(ws);
    const row = await this.repo.payment(paymentId);
    // Another broker's payment is not there, as far as this one can tell.
    if (!row || row.brokerId !== broker.id) throw new NotFoundException('We could not find that payment.');
    return present(await this.resolve(row));
  }

  /**
   * Move to a cheaper plan when the month ends, keep the current one, or
   * switch the Province plan's province. Never takes money.
   */
  async change(ws: WorkspaceAccess, body: BrokerPlanChangeRequest): Promise<BrokerPlanOverview> {
    const broker = await this.brokerOf(ws);
    this.assertActive(broker);
    const today = kigaliToday(this.now());
    const live = await this.repo.live(broker.id);
    const home = await this.repo.home(broker.id);
    const inForce = live && effectiveScope(liveOf(live), home.districtId, today).plan !== 'district' ? live : null;
    if (!inForce) {
      if (body.plan === 'district') return this.overview(ws);
      throw new ConflictException('Pay for this plan to start it.');
    }
    if (body.plan === 'district') {
      await this.repo.schedule(inForce.id, { cancel: true, nextPlanId: null, nextProvinceId: null });
      return this.overview(ws);
    }
    const plan = await this.repo.plan(body.plan);
    if (!plan || !plan.active) throw new ConflictException('That plan is not offered right now.');
    const provinceId = plan.code === 'province' ? (body.provinceId ?? inForce.provinceId ?? home.provinceId) : null;
    if (plan.code === 'province' && (provinceId === null || !(await this.repo.province(provinceId)))) {
      throw new BadRequestException('Choose a province from the list.');
    }

    if (plan.code === inForce.planCode) {
      if (plan.code === 'province' && provinceId !== inForce.provinceId) {
        // A new province at once, at most once a month, so it is not a way to see the country.
        const from = districtChangeFrom(inForce.scopeChangedAt, this.now(), kigaliToday);
        if (from) throw new ConflictException(`You can change the province again from ${dayWords(from)}.`);
        await this.repo.setProvince(inForce.id, provinceId as number);
      }
      // Choosing the plan you have undoes a change scheduled for the month's end.
      await this.repo.schedule(inForce.id, { cancel: false, nextPlanId: null, nextProvinceId: null });
      return this.overview(ws);
    }
    if (plan.priceRwf > inForce.planPriceRwf) throw new ConflictException('Pay for this plan to move up to it.');
    await this.repo.schedule(inForce.id, { cancel: false, nextPlanId: plan.id, nextProvinceId: provinceId });
    return this.overview(ws);
  }

  /** The district a broker works in. On the free plan, once per 30 days. */
  async setHomeDistrict(ws: WorkspaceAccess, body: BrokerHomeDistrictRequest): Promise<BrokerPlanOverview> {
    const broker = await this.brokerOf(ws);
    const district = await this.repo.district(body.districtId);
    if (!district) throw new BadRequestException('Choose a district from the list.');
    const home = await this.repo.home(broker.id);
    if (home.districtId === district.id) return this.overview(ws);
    const scope = await this.scopeFor(broker.id);
    if (scope.plan === 'district' && home.districtId !== null) {
      const from = districtChangeFrom(home.changedAt, this.now(), kigaliToday);
      if (from) throw new ConflictException(`On the free plan your district can change once a month. You can change it again from ${dayWords(from)}.`);
    }
    await this.repo.setHomeDistrict(broker.id, district.id, home.districtId !== null);
    return this.overview(ws);
  }

  // --- The hourly sweep --------------------------------------------------------

  /**
   * Run by the BrokerPlans job every hour, every part idempotent:
   * settle what the gateway settled, renew what is due, end what was asked to
   * end, and drop what ran out of grace.
   */
  async sweep(now: Date = this.now()): Promise<{ settled: number; renewed: number; ended: number; lapsed: number }> {
    const today = kigaliToday(now);
    let settled = 0;
    const waiting = await this.repo.pendingPayments(new Date(now.getTime() - 60_000));
    for (let i = 0; i < waiting.length; i += SWEEP_CONCURRENCY) {
      const batch = await Promise.all(waiting.slice(i, i + SWEEP_CONCURRENCY).map((p) => this.resolve(p)));
      settled += batch.filter((p) => p.status === 'paid').length;
    }

    let renewed = 0;
    let ended = 0;
    for (const sub of await this.repo.due(today)) {
      if (sub.cancelAtPeriodEnd) {
        if (await this.repo.setStatus(sub.id, ['active'], 'expired')) {
          ended += 1;
          await this.mail(sub, {
            subject: 'You are on the free District plan',
            heading: 'Your plan ended',
            lines: [
              `Your ${planWords(sub.planCode)} plan ended on ${dayWords(sub.periodEnd)}, as you asked. You now see the homes in your own district.`,
              'Your placements and messages are all still there.',
            ],
            label: 'See plans',
          });
        }
        continue;
      }
      if (sub.nextPlanCode && sub.nextPlanCode !== 'district') await this.repo.applyNext(sub.id);
      const current = (await this.repo.subscription(sub.id)) ?? sub;
      if (await this.renew({ ...sub, ...current })) renewed += 1;
    }

    let lapsed = 0;
    // Past due and three days on: back to District.
    for (const sub of await this.repo.lapsed(addDays(today, -BROKER_PLAN_GRACE_DAYS))) {
      if (await this.repo.setStatus(sub.id, ['past_due'], 'expired')) {
        lapsed += 1;
        await this.mail(sub, {
          subject: 'You are back on the free District plan',
          heading: 'Your plan was not renewed',
          lines: [
            `We could not take the payment for your ${planWords(sub.planCode)} plan, so you now see the homes in your own district only.`,
            'Nothing was deleted. Pay for a plan again to see more.',
          ],
          label: 'See plans',
        });
      }
    }
    if (settled || renewed || ended || lapsed) {
      this.logger.log(`Broker plans: settled ${settled}, renewed ${renewed}, ended ${ended}, lapsed ${lapsed}.`);
    }
    return { settled, renewed, ended, lapsed };
  }

  /**
   * Charge the next month of a plan that is due. The plan turns past due
   * at once and back to active when the money lands; a failure tells the
   * broker to pay now. True when a charge went out.
   */
  private async renew(sub: RenewalRow): Promise<boolean> {
    const plan = await this.repo.plan(sub.planCode);
    if (!plan || !plan.active || plan.priceRwf <= 0) {
      await this.repo.setStatus(sub.id, ['active'], 'expired');
      return false;
    }
    await this.repo.setStatus(sub.id, ['active'], 'past_due');
    const periodStart = sub.periodEnd;
    const periodEnd = addMonth(periodStart);
    const method = sub.payMethod;
    const canCharge =
      this.paymentMode !== 'off' &&
      ((method === 'mtn_momo' || method === 'airtel_money') ? Boolean(sub.payMsisdn) : method === 'card' ? Boolean(sub.cardToken) : false);
    if (!canCharge || !method) {
      await this.payNowMail(sub, plan.priceRwf);
      return false;
    }
    const key = `broker-plan:${sub.id}:renewal:${periodStart}`;
    const id = await this.repo.insertPayment({
      subscriptionId: sub.id,
      brokerId: sub.brokerId,
      planId: plan.id,
      kind: 'renewal',
      periodStart,
      periodEnd,
      amountRwf: plan.priceRwf,
      method,
      msisdnMasked: sub.payMsisdn ? maskDestination(`0${sub.payMsisdn}`) : null,
      adapterMode: this.payments.mode,
      idempotencyKey: key,
    });
    // Already tried for this month: the broker pays it from the Plan page.
    if (!id) return false;
    const row = await this.repo.payment(id);
    if (!row) return false;
    const instrument: SubscriptionChargeCommand['instrument'] =
      method === 'card'
        ? { kind: 'card', token: sub.cardToken as string }
        : { kind: 'mobile_money', network: method, msisdn: sub.payMsisdn as string };
    await this.charge(row, sub.workspaceId, instrument);
    const after = await this.repo.payment(id);
    if (after?.status === 'failed') await this.payNowMail(sub, plan.priceRwf, after.failureReason);
    return true;
  }

  // --- Money -------------------------------------------------------------------

  /** One call to the gateway; a refusal is written on the payment, never thrown. */
  private async charge(row: PaymentRow, workspaceId: string, instrument: SubscriptionChargeCommand['instrument']): Promise<void> {
    try {
      const receipt = await this.payments.chargeSubscription({
        kind: 'subscription_charge',
        idempotencyKey: row.idempotencyKey,
        amountRwf: row.amountRwf,
        currency: 'RWF',
        workspaceId,
        memo: `Injishi ${planWords(row.planCode)} plan ${row.periodStart}`,
        instrument,
        subscriptionRef: row.subscriptionId,
      });
      await this.repo.attachRef(row.id, receipt.adapterRef, receipt.checkoutUrl ?? null);
      if (receipt.settlement === 'settled') {
        await this.paid({ ...row, gatewayRef: receipt.adapterRef }, receipt.savedCardToken ?? null);
      }
    } catch (cause) {
      if (cause instanceof PaymentDeclinedError) {
        await this.failed(row, `The payment was declined: ${cause.reason}. Nothing was taken.`);
      } else if (cause instanceof PaymentUnavailableError) {
        await this.failed(row, 'The payment service did not answer. Nothing was taken.');
      } else {
        throw cause;
      }
    }
  }

  /** Ask the gateway about a waiting payment; give up on one left too long. */
  private async resolve(row: PaymentRow): Promise<PaymentRow> {
    if (row.status !== 'pending') return row;
    if (row.gatewayRef && row.workspaceId) {
      const receipt = await this.payments.fetchTransaction(row.workspaceId, row.gatewayRef).catch(() => null);
      if (receipt?.settlement === 'settled') {
        await this.paid(row, receipt.savedCardToken ?? null);
        return (await this.repo.payment(row.id)) ?? row;
      }
    }
    const limit = row.method === 'card' ? CHECKOUT_EXPIRES_MS : PROMPT_EXPIRES_MS;
    if (this.now().getTime() - row.createdAt.getTime() > limit) {
      await this.failed(
        row,
        row.method === 'card'
          ? 'The card page was left before paying. Nothing was taken.'
          : 'The prompt on your phone expired before it was approved. Nothing was taken.',
      );
      return (await this.repo.payment(row.id)) ?? row;
    }
    return row;
  }

  private async paid(row: PaymentRow, cardToken: string | null): Promise<void> {
    const applied = await this.repo.applyPaid(row, cardToken);
    if (!applied || !(await this.repo.claimReceipt(row.id))) return;
    const contact = await this.repo.contactFor(row.brokerId);
    if (!contact.email || !this.mailer) return;
    const sub = await this.repo.subscription(row.subscriptionId);
    const area = sub?.planCode === 'province' ? `all of ${provinceLabel(sub.provinceName ?? '')}` : 'all of Rwanda';
    void this.mailer.send(`Broker plan payment ${row.id}`, contact.email, {
      subject: `Receipt: RWF ${RWF.format(row.amountRwf)} for your ${planWords(row.planCode)} plan`,
      heading: `Paid: RWF ${RWF.format(row.amountRwf)}`,
      lines: [
        `Your ${planWords(row.planCode)} plan runs from ${dayWords(row.periodStart)} to ${dayWords(row.periodEnd)}. You see the homes in ${area}.`,
        `Paid by ${methodWords(row)} on ${dayWords(kigaliToday(this.now()))}. Reference ${row.id.slice(0, 8)}.`,
      ],
      action: { label: 'See your plan', url: this.planLink() },
    });
  }

  private async failed(row: PaymentRow, reason: string): Promise<void> {
    if (!(await this.repo.failPayment(row.id, reason))) return;
    // An upgrade that was not paid never starts; the plan the broker had stands.
    if (row.kind === 'start') await this.repo.dropPendingStart(row.subscriptionId);
  }

  /** An upgrade left waiting past its prompt is let go, so a new one can start. */
  private async clearLapsedStart(brokerId: string): Promise<void> {
    const pending = await this.repo.pendingStart(brokerId);
    if (!pending) return;
    const latest = await this.repo.latestPayment(pending.id);
    if (latest) {
      const fresh = await this.resolve(latest);
      if (fresh.status === 'pending') {
        throw new ConflictException('A payment for a plan is already waiting. Approve or decline it first.');
      }
      if (fresh.status === 'paid') return;
    }
    await this.repo.dropPendingStart(pending.id);
  }

  private async payNowMail(sub: RenewalRow, priceRwf: number, reason?: string | null): Promise<void> {
    await this.mail(sub, {
      subject: `Pay now to keep your ${planWords(sub.planCode)} plan`,
      heading: 'Your plan needs paying',
      lines: [
        `${reason ?? 'We could not take this month\'s payment.'} Pay RWF ${RWF.format(priceRwf)} by ${dayWords(graceUntil(sub.periodEnd))} to keep seeing ${sub.planCode === 'country' ? 'all of Rwanda' : `all of ${provinceLabel(sub.provinceName ?? '')}`}.`,
        'After that you are back on the free District plan. Nothing is deleted.',
      ],
      label: 'Pay now',
    });
  }

  private async mail(sub: RenewalRow, m: { subject: string; heading: string; lines: string[]; label: string }): Promise<void> {
    if (!this.mailer || !sub.email) return;
    void this.mailer.send(`Broker plan ${sub.id}`, sub.email, {
      subject: m.subject,
      heading: m.heading,
      lines: m.lines,
      action: { label: m.label, url: this.planLink() },
    });
  }

  /** The plan page; with a payment, where the gateway's card page sends the payer back. */
  private planLink(paymentId?: string): string {
    const url = new URL(PLAN_PATH, this.mailer?.appUrl ?? 'http://localhost:3002');
    if (paymentId) url.searchParams.set('payment', paymentId);
    return url.toString();
  }

  private returnUrl(_workspaceId: string, paymentId: string): string {
    return this.planLink(paymentId);
  }

  // --- Who is asking -----------------------------------------------------------

  async brokerOf(ws: WorkspaceAccess): Promise<BrokerSelfRow> {
    if (ws.kind !== 'broker') throw new ForbiddenException('This is not a broker workspace.');
    const broker = await this.brokers.brokerForWorkspace(ws.workspaceId);
    if (!broker) {
      throw new NotFoundException('This broker workspace has no broker registration behind it. Register as a broker first.');
    }
    return broker;
  }

  private assertActive(broker: BrokerSelfRow): void {
    if (broker.status !== 'active') {
      throw new UnprocessableEntityException('Your broker account is suspended, so you cannot change your plan. Contact Injishi support.');
    }
  }
}

function liveOf(live: SubscriptionRow | null): LivePlan | null {
  if (!live || (live.status !== 'active' && live.status !== 'past_due')) return null;
  return {
    plan: live.planCode,
    status: live.status,
    provinceId: live.provinceId,
    periodEnd: live.periodEnd,
    cancelAtPeriodEnd: live.cancelAtPeriodEnd,
  };
}

function planPrice(plans: PlanRow[], code: BrokerPlanCode): number | null {
  return plans.find((p) => p.code === code)?.priceRwf ?? null;
}

function planWords(code: BrokerPlanCode): string {
  return code === 'country' ? 'Country' : code === 'province' ? 'Province' : 'District';
}

function methodWords(row: Pick<PaymentRow, 'method' | 'msisdnMasked'>): string {
  const label = BROKER_PAY_METHOD_LABEL[row.method as BrokerPayMethod];
  return row.msisdnMasked ? `${label} ${row.msisdnMasked}` : label;
}

function present(row: PaymentRow): BrokerPlanPayment {
  return {
    id: row.id,
    planCode: row.planCode,
    kind: row.kind,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    amountRwf: row.amountRwf,
    method: row.method,
    methodWords: methodWords(row),
    status: row.status,
    failureReason: row.failureReason,
    checkoutUrl: row.status === 'pending' ? row.checkoutUrl : null,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
