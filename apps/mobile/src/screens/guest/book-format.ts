/**
 * Everything the booking stepper decides that does not need a screen.
 *
 * Pure functions taking `t` where they produce a sentence, so a test asserts
 * the note a guest reads in either catalogue without rendering a field. The
 * payment validation in particular is worth testing without a keyboard: it is
 * the only place in the Guest flow where the app tells someone their input is
 * wrong, and getting THAT wrong is how a correct number gets rejected.
 */
import { computeBreakdown, type MoneyBreakdown } from '@injishi/contracts';
import type { MessageKey, Translate } from '@/i18n/i18n';
import type { DateRange, IsoDay } from '@/components';
import { nightsBetween } from '@/components';
import { billableGuests, type GuestParty } from '@/data/search';

/* ------------------------------------------------------------ the methods */

export type PayMethod = 'momo' | 'airtel' | 'card';

export interface PayMethodSpec {
  id: PayMethod;
  label: MessageKey;
  hint: MessageKey;
  icon: 'smartphone' | 'creditCard';
  /**
   * The two-digit national prefixes this network issues, or `null` for a
   * method that takes no handset. Rwanda's mobile money numbering, as the
   * canvas's `bookPay` logic block has it: MTN on 78 and 79, Airtel on 72
   * and 73.
   */
  prefixes: readonly string[] | null;
}

/**
 * MoMo first, then Airtel, then card — the canvas order, and it is not
 * alphabetical or arbitrary. Mobile money is how Rwanda pays; a card list that
 * opened with Visa would be an app built for somebody else's market.
 */
export const PAY_METHODS: readonly PayMethodSpec[] = [
  {
    id: 'momo',
    label: 'book.method.momo',
    hint: 'book.methodHint.momo',
    icon: 'smartphone',
    prefixes: ['78', '79'],
  },
  {
    id: 'airtel',
    label: 'book.method.airtel',
    hint: 'book.methodHint.airtel',
    icon: 'smartphone',
    prefixes: ['72', '73'],
  },
  {
    id: 'card',
    label: 'book.method.card',
    hint: 'book.methodHint.card',
    icon: 'creditCard',
    prefixes: null,
  },
];

export function payMethod(id: PayMethod): PayMethodSpec {
  const found = PAY_METHODS.find((m) => m.id === id);
  /* istanbul ignore next -- the id is a union; this cannot be reached */
  if (!found) throw new Error(`unknown payment method ${id}`);
  return found;
}

/* ----------------------------------------------------------- the handset */

export const digitsOf = (raw: string): string => raw.replace(/[^0-9]/g, '');

/**
 * The nine national digits behind whatever the guest typed.
 *
 * A Rwandan handset is written four ways and all four are correct:
 * `0788431209`, `788431209`, `+250788431209`, `250 788 431 209`. Normalising
 * before validating is what stops the field rejecting a number the guest reads
 * off the back of their own phone.
 */
export function nationalDigits(raw: string): string {
  const d = digitsOf(raw);
  if (d.startsWith('250')) return d.slice(3);
  if (d.startsWith('0')) return d.slice(1);
  return d;
}

/**
 * `788431209` -> `0788 431 209`, the way a Rwandan number is written.
 *
 * **The canvas contradicts itself here and this follows the example, not the
 * code.** `bookPay`'s logic block groups the national number 2-3-4, which
 * prints `078 843 1209`; the placeholder and the error message on the same
 * artboard both write `0788 123 456`, which is 3-3-3 after the leading zero.
 * The strings are what a guest reads and they are the ones that match how the
 * number is written on a SIM pack, so the grouping follows them.
 */
export function formatHandset(national: string): string {
  return `0${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6, 9)}`;
}

/** As typed, in `78X XXX XXX` groups, so the field reads back what it holds. */
export function groupHandset(raw: string): string {
  const d = nationalDigits(raw).slice(0, 9);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join(' ');
}

/** Which method, if any, issues this number. Drives the cross-network note. */
export function networkFor(national: string): PayMethodSpec | undefined {
  const head = national.slice(0, 2);
  return PAY_METHODS.find((m) => m.prefixes?.includes(head));
}

/**
 * A field note: what the guest is told under the handset input.
 *
 * `ok` is what the CTA reads. `tone` is what the field paints, and the two are
 * NOT the same question — an empty field is not ok and is not an error either,
 * because a guest who has not typed yet has done nothing wrong. Colouring an
 * untouched field red is how a form starts an argument on arrival.
 */
export interface FieldNote {
  ok: boolean;
  tone: 'none' | 'hint' | 'error';
  text: string | null;
}

const CLEAN: FieldNote = { ok: false, tone: 'none', text: null };

/**
 * The canvas's own four outcomes, in its own order: empty, not nine digits,
 * the other network, good.
 *
 * The pattern the prompt names, `+250 7[2389]X XXX XXX`, is exactly the union
 * of the two networks' prefixes, so it is checked as membership rather than
 * as a second regex that could disagree with `PAY_METHODS`.
 */
export function checkHandset(raw: string, method: PayMethod, t: Translate): FieldNote {
  const spec = payMethod(method);
  if (!spec.prefixes) return CLEAN;
  if (raw.trim() === '') return CLEAN;

  const national = nationalDigits(raw);
  if (!/^[0-9]{9}$/.test(national)) {
    return { ok: false, tone: 'error', text: t('book.phoneNineDigits') };
  }

  if (!spec.prefixes.includes(national.slice(0, 2))) {
    const other = networkFor(national);
    return {
      ok: false,
      tone: 'error',
      text: other
        ? t('book.phoneOtherNetwork', { network: t(other.label) })
        : t('book.phoneWrongNetwork', {
            network: t(spec.label),
            prefixes: spec.prefixes.join(` ${t('book.or')} `),
          }),
    };
  }

  return { ok: true, tone: 'hint', text: t('book.phonePrompt', { number: formatHandset(national) }) };
}

/* -------------------------------------------------------------- the card */

/**
 * The Luhn check digit.
 *
 * Worth having even in a prototype with a mock adapter, because it is the one
 * card check that catches a real typo — a transposed pair or a single wrong
 * digit — before the guest waits on a decline they cannot read.
 */
export function luhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return digits.length > 0 && sum % 10 === 0;
}

/** `4242424242424242` -> `4242 4242 4242 4242`, capped at 19 digits. */
export function groupCard(raw: string): string {
  const d = digitsOf(raw).slice(0, 19);
  return (d.match(/.{1,4}/g) ?? []).join(' ');
}

export function checkCardNumber(raw: string, t: Translate): FieldNote {
  if (raw.trim() === '') return CLEAN;
  const d = digitsOf(raw);
  if (d.length < 13 || d.length > 19) {
    return { ok: false, tone: 'error', text: t('book.cardShort') };
  }
  if (!luhn(d)) return { ok: false, tone: 'error', text: t('book.cardChecksum') };
  return { ok: true, tone: 'none', text: null };
}

/** `0928` -> `09 / 28`. Typed straight through, never re-parsed from display. */
export function groupExpiry(raw: string): string {
  const d = digitsOf(raw).slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)} / ${d.slice(2)}`;
}

/**
 * `now` is an argument rather than a `Date.now()` inside, so the "expired"
 * boundary is testable. A card expires at the END of its month, which is why
 * the comparison is on the month and not on a day.
 */
export function checkExpiry(raw: string, t: Translate, now = new Date()): FieldNote {
  if (raw.trim() === '') return CLEAN;
  const d = digitsOf(raw);
  if (d.length !== 4) return { ok: false, tone: 'error', text: t('book.expiryFormat') };

  const month = Number(d.slice(0, 2));
  const year = 2000 + Number(d.slice(2));
  if (month < 1 || month > 12) {
    return { ok: false, tone: 'error', text: t('book.expiryFormat') };
  }

  const thisMonth = now.getFullYear() * 12 + now.getMonth();
  const cardMonth = year * 12 + (month - 1);
  if (cardMonth < thisMonth) return { ok: false, tone: 'error', text: t('book.expiryPast') };

  return { ok: true, tone: 'none', text: null };
}

export function checkCvv(raw: string, t: Translate): FieldNote {
  if (raw.trim() === '') return CLEAN;
  const d = digitsOf(raw);
  if (d.length < 3 || d.length > 4) {
    return { ok: false, tone: 'error', text: t('book.cvvShort') };
  }
  return { ok: true, tone: 'none', text: null };
}

/* ------------------------------------------------------------- the gates */

/**
 * Whether a step's input is complete, and the sentence to print under the
 * button when it is not.
 *
 * The design brief's rule is that a consequence is printed under the button
 * rather than discovered after it, so a disabled CTA always carries its
 * reason — the same contract Session 3's sticky bar signs. The order is the
 * order the guest can act on it: what they must choose before what they must
 * tick.
 */
export interface StepInput {
  dates: DateRange;
  party: GuestParty;
  /** The room's `capacity`, which infants do not count against. */
  sleeps: number;
  soldOut: boolean;
  acceptedRules: boolean;
  method: PayMethod;
  handset: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
}

export function blockedOnDates(input: StepInput): MessageKey | null {
  if (input.soldOut) return 'book.blockedSoldOut';
  if (!input.dates.start || !input.dates.end) return 'book.blockedDates';
  if (billableGuests(input.party) > input.sleeps) return 'book.blockedParty';
  return null;
}

export function blockedOnSummary(input: StepInput): MessageKey | null {
  return input.acceptedRules ? null : 'book.blockedRules';
}

export function blockedOnPay(input: StepInput, now = new Date()): MessageKey | null {
  if (payMethod(input.method).prefixes) {
    const national = nationalDigits(input.handset);
    return /^[0-9]{9}$/.test(national) &&
      (payMethod(input.method).prefixes as readonly string[]).includes(national.slice(0, 2))
      ? null
      : 'book.blockedHandset';
  }

  const d = digitsOf(input.cardNumber);
  const okNumber = d.length >= 13 && d.length <= 19 && luhn(d);
  const okExpiry = expiryOk(input.cardExpiry, now);
  const okCvv = digitsOf(input.cardCvv).length >= 3 && digitsOf(input.cardCvv).length <= 4;
  return okNumber && okExpiry && okCvv ? null : 'book.blockedCard';
}

function expiryOk(raw: string, now: Date): boolean {
  const d = digitsOf(raw);
  if (d.length !== 4) return false;
  const month = Number(d.slice(0, 2));
  if (month < 1 || month > 12) return false;
  const cardMonth = (2000 + Number(d.slice(2))) * 12 + (month - 1);
  return cardMonth >= now.getFullYear() * 12 + now.getMonth();
}

/** The three gates, indexed by step, so the container asks one question. */
export const STEP_GATES: readonly ((input: StepInput) => MessageKey | null)[] = [
  blockedOnDates,
  blockedOnSummary,
  (input) => blockedOnPay(input),
];

/* --------------------------------------------------------- the arithmetic */

/**
 * What the stay costs, through the ONE implementation in `@injishi/contracts`.
 *
 * Never re-derived here. `computeBreakdown` applies the non-refundable
 * discount to the accommodation total and rounds once, and a second copy of
 * that rounding rule is a quote that eventually disagrees with the charge —
 * which is the whole reason ADR-014 moved it into the shared package. Returns
 * `undefined` rather than a zero breakdown when there is nothing to price, so
 * a caller cannot print a total the guest never asked for.
 */
export function quote(args: {
  nightlyRateRwf: number | null;
  dates: DateRange;
  nonRefundable: boolean;
  /** Billable guests (adults plus children). A stay is priced per person; infants are free. */
  guests?: number;
}): MoneyBreakdown | undefined {
  const { nightlyRateRwf, dates } = args;
  if (nightlyRateRwf === null || !dates.start || !dates.end) return undefined;
  const nights = nightsBetween(dates.start, dates.end);
  if (nights < 1) return undefined;
  return computeBreakdown({ nightlyRateRwf, nights, nonRefundable: args.nonRefundable, guests: args.guests });
}

/** Nights in the range, or 0 while it is incomplete. */
export function nightsIn(dates: DateRange): number {
  return dates.start && dates.end ? nightsBetween(dates.start, dates.end) : 0;
}

/* --------------------------------------------------------------- the mint */

/**
 * A v4 uuid for `CreateBookingInput.attemptToken` (ADR-020 D-c).
 *
 * **`Math.random` is deliberate and is a prototype-only choice.** The token's
 * job is to be unique per press, not to be unguessable: it is minted on the
 * device, sent with the request and used by the server as a duplicate key. The
 * app ships `expo-crypto` nowhere and this session may not add a dependency, so
 * this is the mint until Phase 3, where `Crypto.randomUUID()` replaces the body
 * of this function and nothing else changes.
 */
export function uuidV4(): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
    else if (i === 14) out += '4';
    else if (i === 19) out += hex[8 + Math.floor(Math.random() * 4)];
    else out += hex[Math.floor(Math.random() * 16)];
  }
  return out;
}

/**
 * The booking reference the guest reads out over the phone: `BK-7Q2M4X`, the
 * canvas's own shape.
 *
 * The alphabet drops `0 O 1 I` on purpose. A reference exists to be read aloud
 * in a noisy reception and typed back in by somebody else, and those four are
 * the pairs that get it wrong.
 */
const REFERENCE_ALPHABET = '23456789ACDEFGHJKLMNPQRSTUVWXYZ';

export function mintReference(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += REFERENCE_ALPHABET[Math.floor(random() * REFERENCE_ALPHABET.length)];
  }
  return `BK-${out}`;
}

/** `Umurage Hospitality Ltd` -> `UH`. The avatar and the confirmation both use it. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '??';
  const letters = words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '');
  return letters.join('') || '??';
}

/** `BK-7Q2M4X` + `Umurage…` -> `INJ-7Q2M4X-UH`, the fixtures' own shape. */
export function confirmationFor(reference: string, host: string): string {
  return `INJ-${reference.replace('BK-', '')}-${initialsOf(host)}`;
}

/** Today plus n days is Session 5's; the check-out day is the check-in plus nights. */
export function checkOutOf(dates: DateRange): IsoDay | null {
  return dates.end ?? null;
}
