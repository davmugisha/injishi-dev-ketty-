/**
 * The tenant's writes, over one store.
 *
 * Frames R12, R16, R17, R18 and R19 all change the same aggregate — a Lease as
 * the tenant holds it — so they share one fixture key and one array rather than
 * five little stores that would each have to be reconciled with the others.
 * Signing a lease starts its rent schedule; filing a notice ends it; paying
 * rent moves a period inside it. Split across five keys those three facts stop
 * agreeing with each other the first time a screen reads the wrong one.
 *
 * **Every change is a pure `apply` exported beside its hook.** That is what
 * `useFixtureMutation` asks for — it will call the same function to build an
 * optimistic update when this becomes `useMutation` — and it is also what makes
 * the rules testable without rendering anything: "signing starts the schedule"
 * and "a notice moves the lease to `ending`" are assertions about a function,
 * not about a screen.
 *
 * `useTenancies` pairs the two halves of the fixture layer deliberately:
 * `useFixture` owns the cold-read latency, the error and the retry, so the four
 * list states are real; `useFixtureValue` owns the live value, so a write on
 * one screen re-renders the list on another. Neither does both, and a screen
 * that used only the first would show a stale ledger the moment rent was paid.
 */
import {
  TENANCIES,
  type MoveOutNotice,
  type PayMethod,
  type RenewalRequest,
  type RentPeriod,
  type Tenancy,
  type VisitorEntry,
} from './rentals';
import { useFixture, type FixtureResult } from './use-fixture';
import { useFixtureMutation, useFixtureValue, type FixtureMutation } from './use-fixture-mutation';

/** The fixture key, and the shape of the endpoint that replaces it. */
export const TENANCIES_KEY = 'tenant.tenancies';

const seed = (): Tenancy[] => TENANCIES;

/* ------------------------------------------------------------ the reads --- */

/**
 * Every tenancy this person holds, with the four states a list owes its reader.
 * `data` is `undefined` until the read settles, which is what makes the
 * skeleton branch reachable rather than decorative.
 */
export function useTenancies(): FixtureResult<readonly Tenancy[]> {
  const live = useFixtureValue<Tenancy[]>(TENANCIES_KEY, seed);
  const gate = useFixture(TENANCIES_KEY, seed);
  return {
    status: gate.status,
    error: gate.error,
    retry: gate.retry,
    data: gate.status === 'ready' ? live : undefined,
  };
}

/**
 * One tenancy. A `ready` read with `data: undefined` is a real outcome and
 * every caller renders it as one — a lease can be withdrawn between the link
 * being written and the link being followed.
 */
export function useTenancy(id: string | undefined): FixtureResult<Tenancy | undefined> {
  const all = useTenancies();
  return {
    ...all,
    data: all.data ? all.data.find((x) => x.id === id) : undefined,
  };
}

/* --------------------------------------------------------- the appliers --- */

/** Replace one tenancy in the array, leaving the rest identical. */
function mapTenancy(all: Tenancy[], id: string, fn: (t: Tenancy) => Tenancy): Tenancy[] {
  return all.map((t) => (t.id === id ? fn(t) : t));
}

export interface SignInput {
  leaseId: string;
  /** `YYYY-MM-DD`. Passed in rather than read from the clock, so it is testable. */
  signedOn: string;
}

/**
 * FL21 step 3 and step 4, together: the tenant signs, the Lease becomes
 * `active`, and **the rent schedule starts at signature**. A lease that went
 * active with an empty ledger would send its tenant to a Rent tab that says
 * "no rent due" on a tenancy they have just committed to.
 *
 * The first charge is `due`, never `overdue`, even when the commencement date
 * has already passed: the charge is raised at signature, and a period that was
 * late before it existed is an accusation the flow has no basis for.
 *
 * The draft contract becomes the signed one in the same move, because R15's
 * "Contract · Download" row reads `documents` and a signed lease whose only
 * document still says "awaiting your signature" is a screen contradicting
 * itself.
 *
 * `signedOnDevice` marks the signature as this phone's alone. Nothing sends it
 * anywhere yet, and the sign screen says so for as long as the lease carries
 * the mark, not only in the render that signed it (mobile audit 2026-10-05,
 * TN-04).
 */
export function applySignature(all: Tenancy[], { leaseId, signedOn }: SignInput): Tenancy[] {
  return mapTenancy(all, leaseId, (t) => {
    if (t.leaseState !== 'pending_signature') return t;
    const first: RentPeriod = {
      month: monthKeyOf(t.startOn),
      amount: t.rent,
      status: 'due',
      dueOn: t.startOn,
    };
    return {
      ...t,
      leaseState: 'active',
      signedOn,
      signedOnDevice: true,
      history: t.history.length > 0 ? t.history : [first],
      documents: t.documents.map((d) =>
        d.label === 'Draft contract'
          ? { label: 'Lease contract', meta: `PDF · 229 KB · signed ${signedOn}` }
          : d,
      ),
    };
  });
}

export interface PayInput {
  leaseId: string;
  /** The `month` of the period being settled, as it appears in `history`. */
  month: string;
  /** `YYYY-MM-DD`. */
  paidOn: string;
  method: PayMethod;
}

/**
 * FL28 step 2, mocked half: the period moves to `paid` and is stamped `mock`.
 * The stamp is the point — ui-rules.md's adapter rule is that a mocked success
 * must never look like a real one, so the flag rides on the ledger row rather
 * than on the screen that wrote it, and every screen drawing that row inherits
 * the obligation to say so.
 */
export function applyRentPayment(
  all: Tenancy[],
  { leaseId, month, paidOn, method }: PayInput,
): Tenancy[] {
  return mapTenancy(all, leaseId, (t) => ({
    ...t,
    history: t.history.map((p) =>
      p.month === month && p.status !== 'paid'
        ? { ...p, status: 'paid' as const, paidOn, method, mock: true }
        : p,
    ),
  }));
}

export interface NoticeInput {
  leaseId: string;
  notice: MoveOutNotice;
}

/**
 * FL23 step 2: the Lease moves to `ending` and carries the notice. `ended` is
 * not this flow's to write — that happens at close, when the Caution settles
 * (FL24) — so the state stops one short of it on purpose.
 */
export function applyMoveOut(all: Tenancy[], { leaseId, notice }: NoticeInput): Tenancy[] {
  return mapTenancy(all, leaseId, (t) =>
    t.leaseState === 'active' || t.leaseState === 'ending'
      ? { ...t, leaseState: 'ending', notice }
      : t,
  );
}

export interface RenewalInput {
  leaseId: string;
  renewal: RenewalRequest;
}

/**
 * FL26 step 1: the request is recorded and waits. The Lease is untouched —
 * `endOn` moves only when the landlord approves (step 3), and a tenant portal
 * that moved it on the request would be showing a term nobody agreed to.
 */
export function applyRenewal(all: Tenancy[], { leaseId, renewal }: RenewalInput): Tenancy[] {
  return mapTenancy(all, leaseId, (t) => ({ ...t, renewal }));
}

export interface VisitorInput {
  leaseId: string;
  visitor: VisitorEntry;
}

/** F-R14: newest first, which is the order frame R19 draws and reads in. */
export function applyVisitor(all: Tenancy[], { leaseId, visitor }: VisitorInput): Tenancy[] {
  return mapTenancy(all, leaseId, (t) => ({ ...t, visitors: [visitor, ...t.visitors] }));
}

/* ------------------------------------------------------------ the hooks --- */

export function useSignLease(): FixtureMutation<SignInput> {
  return useFixtureMutation<Tenancy[], SignInput>(TENANCIES_KEY, applySignature, seed);
}

export function useSettleRent(): FixtureMutation<PayInput> {
  return useFixtureMutation<Tenancy[], PayInput>(TENANCIES_KEY, applyRentPayment, seed);
}

export function useFileMoveOut(): FixtureMutation<NoticeInput> {
  return useFixtureMutation<Tenancy[], NoticeInput>(TENANCIES_KEY, applyMoveOut, seed);
}

export function useRequestRenewal(): FixtureMutation<RenewalInput> {
  return useFixtureMutation<Tenancy[], RenewalInput>(TENANCIES_KEY, applyRenewal, seed);
}

export function useLogVisitor(): FixtureMutation<VisitorInput> {
  return useFixtureMutation<Tenancy[], VisitorInput>(TENANCIES_KEY, applyVisitor, seed);
}

/* ---------------------------------------------------------- derivations --- */

/**
 * The English month key a ledger row is stored under (`2026-09-01` ->
 * `September 2026`).
 *
 * Deliberately NOT localised: `history[].month` is the row's identity — it is
 * what `applyRentPayment` matches on — and an identity that changes when the
 * reader switches language is an identity that stops matching. The screens
 * render `dueOn` through the locale's own month names instead, so a
 * Kinyarwanda reader never sees this string.
 */
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function monthKeyOf(iso: string): string {
  return `${MONTH_NAMES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}
